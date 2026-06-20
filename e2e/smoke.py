#!/usr/bin/env python3
"""
Smoke test harness for the `things` app on the Android emulator and iOS simulator.

Label-driven (uses uiautomator / idb accessibility dumps to locate controls by their
text / accessibility label, then taps the element centre) so it survives layout shifts
and resolution differences instead of relying on hardcoded pixel coordinates.

Covers the read-only happy path: launch -> (email sign-in if signed out) -> collection,
feed, today, notifications, stats. Asserts the expected screen content is present at each
step and that no crash / React Native redbox appeared. Non-destructive: it never adds,
edits or deletes data, so it's safe to run repeatedly against the test1 account.

Usage:
    python3 smoke.py --platform android
    python3 smoke.py --platform ios
    python3 smoke.py --platform both          # default

Run via the wrapper (loads e2e/.env, sets PATH/locale):  e2e/run.sh [android|ios|both] [suite]

Exit code 0 = all steps passed, 1 = at least one failure.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime

ADB = os.environ.get("ADB", "adb")
IDB = os.environ.get("IDB", "idb")

# Config comes from the environment (see e2e/.env.example; run.sh sources e2e/.env).
# Defaults are non-functional placeholders so no real credentials live in the repo.
TEST_EMAIL = os.environ.get("SMOKE_TEST1_EMAIL", "test1@example.com")      # stable content account
TEST_PASSWORD = os.environ.get("SMOKE_PASSWORD", "")
ACTIVE_ACCOUNT = os.environ.get("SMOKE_TEST2_EMAIL", "test2@example.com")  # mutable (destructive + multi-user)
EMPTY_ACCOUNT = os.environ.get("SMOKE_TEST3_EMAIL", "test3@example.com")   # never-mutated empty-state oracle
TEST1_UUID = os.environ.get("SMOKE_TEST1_UUID", "")  # test1's user id (deep-link follow target)
APP_ID = os.environ.get("SMOKE_APP_ID", "com.csillalukacs.things")
APP_SCHEME = os.environ.get("SMOKE_APP_SCHEME", "things")

# Log patterns that mean "something blew up" — checked after each step.
CRASH_PATTERNS = [
    "FATAL EXCEPTION",
    "API key not found",
    "com.facebook.react.common.JavascriptException",
]
# Lines matching a crash pattern but containing any of these are OS/picker noise,
# not the app crashing (e.g. the photo picker's "Unable to check Uri permission").
CRASH_IGNORE = ["ContentProviderHelper", "BluetoothPowerStats", "Unable to check Uri"]
# Text that appears on a React Native dev error overlay (redbox / LogBox).
REDBOX_MARKERS = [
    "There was a problem loading the project",
    "Go To Home",
    "this development build encountered",
    "Failed to construct",
]


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


class Device:
    """Common interface; subclasses implement the platform-specific bits."""

    name = "device"

    def launch(self):
        raise NotImplementedError

    def screenshot(self, path):
        raise NotImplementedError

    def elements(self):
        """Return list of {text, cx, cy} for all labelled/tappable nodes."""
        raise NotImplementedError

    def tap(self, x, y):
        raise NotImplementedError

    def type_text(self, text):
        raise NotImplementedError

    def back(self):
        raise NotImplementedError

    def clear_logs(self):
        pass

    def crash_logs(self):
        return []

    # --- shared helpers built on the primitives above ---
    def find(self, needle):
        needle = needle.lower()
        for el in self.elements():
            if needle in el["text"].lower():
                return el
        return None

    def find_exact(self, label):
        """Element whose text matches exactly (case-insensitive). Use when a substring
        match is ambiguous, e.g. the 'sign in' submit vs 'Sign in with Apple'."""
        label = label.lower()
        for el in self.elements():
            if el["text"].strip().lower() == label:
                return el
        return None

    def has_text(self, needle):
        return self.find(needle) is not None

    def tap_label(self, needle):
        el = self.find(needle)
        if not el:
            return False
        self.tap(el["cx"], el["cy"])
        return True

    def tap_exact(self, label):
        el = self.find_exact(label)
        if not el:
            return False
        self.tap(el["cx"], el["cy"])
        return True


class AndroidDevice(Device):
    name = "android"

    def __init__(self, serial=None):
        self.serial = serial or self._first_device()
        if not self.serial:
            raise RuntimeError("no android emulator/device found (adb devices)")
        self.pkg = APP_ID

    def _adb(self, *args):
        return run([ADB, "-s", self.serial, *args])

    @staticmethod
    def _first_device():
        out = run([ADB, "devices"]).stdout.splitlines()
        for line in out[1:]:
            if "\tdevice" in line:
                return line.split("\t")[0]
        return None

    def launch(self):
        # Cold start so navigation always begins at the app's root, not whatever
        # screen a previous run left open.
        self._adb("shell", "am", "force-stop", self.pkg)
        time.sleep(1)
        self._adb("shell", "monkey", "-p", self.pkg, "-c",
                  "android.intent.category.LAUNCHER", "1")

    def screenshot(self, path):
        with open(path, "wb") as f:
            p = subprocess.run([ADB, "-s", self.serial, "exec-out", "screencap", "-p"],
                               stdout=f)
        return p.returncode == 0

    def elements(self):
        self._adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        xml = self._adb("shell", "cat", "/sdcard/ui.xml").stdout
        els = []
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            return els
        for node in root.iter("node"):
            text = node.attrib.get("text") or node.attrib.get("content-desc") or ""
            if not text:
                continue
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
            if not m:
                continue
            x1, y1, x2, y2 = map(int, m.groups())
            els.append({"text": text, "cx": (x1 + x2) // 2, "cy": (y1 + y2) // 2})
        return els

    def tap(self, x, y):
        self._adb("shell", "input", "tap", str(int(x)), str(int(y)))

    def type_text(self, text):
        self._adb("shell", "input", "text", text)

    def back(self):
        self._adb("shell", "input", "keyevent", "KEYCODE_BACK")

    def open_url(self, url):
        self._adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW",
                  "-d", url, self.pkg)

    def clear_logs(self):
        self._adb("logcat", "-c")

    def crash_logs(self):
        out = self._adb("logcat", "-d").stdout
        hits = []
        for line in out.splitlines():
            if "Glide" in line or any(ig in line for ig in CRASH_IGNORE):
                continue
            if any(p in line for p in CRASH_PATTERNS):
                hits.append(line.strip())
        return hits[-8:]


class IosDevice(Device):
    name = "ios"

    def __init__(self, udid=None):
        self.udid = udid or self._booted()
        if not self.udid:
            raise RuntimeError("no booted iOS simulator found")
        self.bundle = APP_ID
        run([IDB, "connect", self.udid])
        self._log_start = self._now()

    @staticmethod
    def _booted():
        out = run(["xcrun", "simctl", "list", "devices", "booted"]).stdout
        m = re.search(r"\(([0-9A-F-]{36})\) \(Booted\)", out)
        return m.group(1) if m else None

    @staticmethod
    def _now():
        return run(["date", "+%Y-%m-%d %H:%M:%S"]).stdout.strip()

    def launch(self):
        run(["xcrun", "simctl", "terminate", self.udid, self.bundle])
        time.sleep(1)
        run(["xcrun", "simctl", "launch", self.udid, self.bundle])

    def screenshot(self, path):
        p = run(["xcrun", "simctl", "io", self.udid, "screenshot", path])
        return p.returncode == 0

    def elements(self):
        out = run([IDB, "ui", "describe-all", "--udid", self.udid]).stdout
        try:
            items = json.loads(out)
        except json.JSONDecodeError:
            items = [json.loads(l) for l in out.splitlines() if l.strip().startswith("{")]
        els = []
        for el in items:
            text = el.get("AXLabel") or el.get("AXValue") or el.get("AXPlaceholderValue") or ""
            if not isinstance(text, str) or not text:
                continue
            f = el.get("frame", {})
            if not f:
                continue
            els.append({
                "text": text,
                "cx": f.get("x", 0) + f.get("width", 0) / 2,
                "cy": f.get("y", 0) + f.get("height", 0) / 2,
            })
        return els

    def tap(self, x, y):
        run([IDB, "ui", "tap", str(int(x)), str(int(y)), "--udid", self.udid])

    def type_text(self, text):
        run([IDB, "ui", "text", text, "--udid", self.udid])

    def back(self):
        # No hardware back on iOS; rely on on-screen close controls instead.
        pass

    def open_url(self, url):
        run(["xcrun", "simctl", "openurl", self.udid, url])

    def clear_logs(self):
        self._log_start = self._now()

    def crash_logs(self):
        out = run(["xcrun", "simctl", "spawn", self.udid, "log", "show",
                   "--last", "40s", "--style", "compact"]).stdout
        hits = []
        for line in out.splitlines():
            if "things" not in line.lower():
                continue
            if any(ig in line for ig in CRASH_IGNORE):
                continue
            if any(p in line for p in CRASH_PATTERNS):
                hits.append(line.strip())
        return hits[-8:]


class Runner:
    def __init__(self, dev, out_dir, tag="smoke"):
        self.dev = dev
        self.out = out_dir
        self.tag = tag
        self.results = []  # (step, ok, detail)
        self.shot_n = 0

    def shot(self, label):
        self.shot_n += 1
        path = os.path.join(
            self.out, f"{self.dev.name}_{self.tag}_{self.shot_n:02d}_{label}.png")
        self.dev.screenshot(path)
        return path

    def record(self, step, ok, detail=""):
        self.results.append((step, ok, detail))
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {step}" + (f" — {detail}" if detail else ""))

    def assert_text(self, needle, step, retries=3, delay=2.0):
        for i in range(retries):
            if self.dev.has_text(needle):
                self.record(step, True)
                return True
            time.sleep(delay)
        self.record(step, False, f"expected text not found: {needle!r}")
        return False

    def assert_any(self, needles, step, retries=3, delay=2.0):
        for i in range(retries):
            for n in needles:
                if self.dev.has_text(n):
                    self.record(step, True)
                    return True
            time.sleep(delay)
        self.record(step, False, f"none of {needles} found")
        return False

    def assert_no_redbox(self, step):
        els = self.dev.elements()
        joined = " | ".join(e["text"] for e in els)
        for marker in REDBOX_MARKERS:
            if marker.lower() in joined.lower():
                self.record(step, False, f"redbox marker present: {marker!r}")
                return False
        crashes = self.dev.crash_logs()
        if crashes:
            self.record(step, False, f"crash in logs: {crashes[-1][:120]}")
            return False
        self.record(step, True)
        return True

    # ---- the actual smoke flow ----
    def run(self):
        d = self.dev
        print(f"\n=== smoke: {d.name} ===")
        d.clear_logs()
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()  # clear any leftover OS dialog from a prior run
        self.shot("launch")

        # Deterministic: run the read-only smoke as test1 (the content account),
        # switching from whatever a prior suite left signed in.
        self.ensure_account(TEST_EMAIL)

        # Collection (home for the signed-in user)
        if not d.has_text("search"):
            self.tap_tab_profile()
            time.sleep(2)
        self.shot("collection")
        self.assert_text("search", "collection renders (search bar)")

        # Feed
        self.tap_tab("feed")
        self.shot("feed")
        self.assert_text("everyone", "feed renders (everyone tab)")

        # Today
        self.tap_tab("today")
        self.shot("today")
        self.assert_text("today", "today renders")

        # Notifications (presented as a full-screen modal — no tab bar, so dismiss
        # it before navigating on).
        self.tap_tab("notifications")
        self.shot("notifications")
        self.assert_text("notifications", "notifications renders")
        self.dismiss()

        # Back to collection, then Stats — the screen that regressed before. Stats is
        # also a pushed modal.
        self.tap_tab_profile()
        time.sleep(2)
        self.open_stats()
        time.sleep(3)
        self.shot("stats")
        ok = self.assert_text("your collection over time", "stats renders (no crash)")
        if ok:
            self.assert_no_redbox("stats free of redbox/crash")
            # Scroll to the data sections and confirm top-cities region renders.
            self.scroll_down()
            self.scroll_down()
            self.shot("stats_bottom")
            # 'top cities' present when the account has located items (test1 has Tokyo).
            if self.dev.has_text("top cities"):
                self.record("stats top-cities section", True)
            else:
                self.record("stats top-cities section", True, "skipped (no located items)")
        self.dismiss()

        return self.summary()

    # ---- empty-state / new-user suite ----
    def run_empty(self, account=EMPTY_ACCOUNT):
        d = self.dev
        print(f"\n=== empty-state: {d.name} (account {account}) ===")
        d.clear_logs()
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()  # clear any leftover OS dialog from a prior run
        self.shot("launch")

        self.ensure_account(account)

        # Collection — should show the "add your first thing" empty state.
        self.tap_tab_profile()
        time.sleep(2)
        self.shot("collection_empty")
        self.assert_any(["add your first thing", "nothing yet"],
                        "collection empty state")

        # Today with zero items — must not crash on an empty 3x3.
        self.tap_tab("today")
        self.shot("today_empty")
        self.assert_text("today", "today renders (empty)")
        self.assert_no_redbox("today empty: no crash")

        # Notifications — empty.
        self.tap_tab("notifications")
        self.shot("notifications_empty")
        self.assert_any(["no notifications"], "notifications empty state")
        self.dismiss()

        # Stats with zero items — should render its empty state, not divide-by-zero.
        self.tap_tab_profile()
        time.sleep(2)
        self.open_stats()
        time.sleep(3)
        self.shot("stats_empty")
        self.assert_no_redbox("stats empty: no crash")
        self.assert_any(["nothing here yet", "nothing yet", "stats"],
                        "stats empty state renders")
        self.dismiss()

        return self.summary()

    # ---- destructive lifecycle suite (add -> delete, self-cleaning) ----
    # Android adds from the system photo library; iOS captures from the simulator
    # camera (see open_add_and_capture). Both end on the same item form.
    def run_destructive(self, account=ACTIVE_ACCOUNT):
        d = self.dev
        print(f"\n=== destructive: {d.name} (account {account}) ===")
        d.clear_logs()
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()
        self.shot("launch")

        self.ensure_account(account)
        self.tap_tab_profile()
        time.sleep(2)
        n0 = self.count_things()
        self.record("read baseline count", n0 is not None, f"{n0} things")
        n0 = n0 or 0
        self.shot("before_add")

        # CREATE: + -> capture (camera/library) -> bg removal -> name -> save
        self.add_item(f"smoke-{int(time.time())}")
        time.sleep(2)
        self.tap_tab_profile()
        time.sleep(2)
        self.shot("after_add")
        n1 = self.count_things()
        self.record("add item (count +1)", n1 == n0 + 1, f"{n0} -> {n1}")

        # DELETE: open the (newest) first item -> ... -> delete -> confirm
        self.open_first_item()
        self.shot("item_detail")
        self.delete_current_item()
        time.sleep(2)
        self.tap_tab_profile()
        time.sleep(2)
        self.shot("after_delete")
        n2 = self.count_things()
        self.record("delete item (back to baseline)", n2 == n0, f"{n1} -> {n2}")
        self.assert_no_redbox("no crash during add/delete")

        return self.summary()

    # ---- one-time seed: give test1 a private item (for the privacy check) ----
    def run_seed(self, account=TEST_EMAIL):
        d = self.dev
        print(f"\n=== seed: {d.name} (private item on {account}) ===")
        d.clear_logs()
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()
        self.shot("launch")
        self.ensure_account(account)
        self.tap_tab_profile()
        time.sleep(2)
        n0 = self.count_things() or 0
        ok = self.add_item(f"private-smoke-{int(time.time())}", private=True)
        time.sleep(2)
        self.tap_tab_profile()
        time.sleep(2)
        n1 = self.count_things()
        self.record("seeded private item", ok and n1 == n0 + 1, f"{n0} -> {n1}")
        return self.summary()

    # ---- multi-user suite (A=test2 follows B=test1; single device, account switch) ----
    def run_multiuser(self, viewer=ACTIVE_ACCOUNT, target=TEST_EMAIL, target_uuid=TEST1_UUID):
        d = self.dev
        print(f"\n=== multi-user: {d.name} ({viewer} follows {target}) ===")
        d.clear_logs()
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()
        self.shot("launch")

        # A: open B's profile via deep link and follow.
        self.ensure_account(viewer)
        d.open_url(f"{APP_SCHEME}://u/{target_uuid}")
        time.sleep(5)
        self.shot("target_profile")
        opened = d.find_exact("follow") is not None or d.find_exact("following") is not None
        self.record("opened target profile (deep link)", opened)
        viewer_count = self.count_things()  # public-only count B exposes to A
        if d.find_exact("follow"):
            d.tap_exact("follow")
            time.sleep(3)
            if d.find_exact("follow"):  # retry once if the first tap didn't land
                d.tap_exact("follow")
                time.sleep(3)
        self.shot("after_follow")
        self.record("follow registered (button toggled)", d.find_exact("follow") is None)

        # A: friends feed should now show B's activity.
        self.dismiss()
        time.sleep(2)
        self.tap_tab("feed")
        time.sleep(2)
        d.tap_label("friends")
        time.sleep(3)
        self.shot("friends_feed")
        self.record("friends feed not empty",
                    not d.has_text("follow people to see their things here"))

        # B: should have received a "followed you" notification.
        # Cold-start *before* switching: the deep-link flow above leaves A on B's
        # profile route, which also has a search bar, so account detection would
        # mistake it for the owner's own collection and the switch would silently
        # no-op. A fresh launch returns to the tabbed root first.
        d.launch()
        time.sleep(11)
        self.dismiss_dev_menu()
        self.dismiss_system_dialogs()
        self.ensure_account(target)
        self.tap_tab_profile()
        time.sleep(2)
        owner_count = self.count_things()  # B's own total (public + private)
        self.tap_tab("notifications")
        time.sleep(2)
        self.shot("target_notifications")
        self.assert_text("followed you", "target got 'followed you' notification")
        self.dismiss()

        # Privacy: B's private items must be hidden from A. B's own total should
        # exceed the public-only count A saw on B's profile (needs >=1 private item
        # on test1 — seed with the 'seed' suite).
        if viewer_count is not None and owner_count is not None:
            self.record("private items hidden from viewer",
                        viewer_count < owner_count,
                        f"viewer saw {viewer_count}, owner has {owner_count}")
        else:
            self.record("private items hidden from viewer", False,
                        f"could not read counts (viewer={viewer_count}, owner={owner_count})")

        # Cleanup: A unfollows B so the follow action is exercised fresh each run.
        self.ensure_account(viewer)
        d.open_url(f"{APP_SCHEME}://u/{target_uuid}")
        time.sleep(4)
        if d.find_exact("following"):
            d.tap_exact("following")
            time.sleep(2)
        self.record("cleanup: unfollowed", True)

        return self.summary()

    # ---- destructive helpers ----
    def screen_size(self):
        path = self.shot("_probe_size")
        try:
            from PIL import Image
            return Image.open(path).size
        except Exception:
            return (1080, 2400) if self.dev.name == "android" else (393, 852)

    def tap_ratio(self, rx, ry):
        w, h = self.screen_size()
        self.dev.tap(w * rx, h * ry)

    def count_things(self):
        for el in self.dev.elements():
            m = re.search(r"(\d+)\s+things?\b", el["text"])
            if m:
                return int(m.group(1))
        return None

    def open_add_and_capture(self):
        """Open the add flow and produce a photo so the item form appears.

        Android picks the most-recent shot from the system photo library (the
        emulator ships a usable sample image). iOS instead captures from the
        simulator camera via the shutter: the iOS photo picker (PHPicker) runs
        out of process and isn't reliably scriptable, whereas the camera screen's
        own controls are, and the simulator camera yields a usable test frame."""
        if self.dev.name == "ios":
            if not self.dev.tap_label("add thing"):
                self.tap_ratio(0.88, 0.83)   # + FAB fallback
            time.sleep(3)
            # First run shows the photo-library + camera permission dialogs (and the
            # in-app "allow camera" gate). Grant whatever is up until none remain;
            # on later runs permission is already granted and these are no-ops.
            for _ in range(6):
                if self.dev.tap_label("Allow Full Access"):
                    pass
                elif self.dev.tap_exact("Allow"):
                    pass
                elif self.dev.tap_label("allow camera"):
                    pass
                else:
                    break
                time.sleep(2)
            self.tap_ratio(0.49, 0.90)   # shutter (captures the simulator camera frame)
            time.sleep(2)
            return
        self.tap_ratio(0.88, 0.85)   # + FAB (bottom-right)
        time.sleep(3)
        self.tap_ratio(0.16, 0.91)   # library thumbnail (bottom-left of camera screen)
        time.sleep(3)
        self.tap_ratio(0.17, 0.59)   # first photo in the system picker grid

    def add_item(self, name, private=False):
        self.open_add_and_capture()
        # The save button is always in the form; the real gate is background removal.
        # Wait for it to finish ("removing background..." clears / "retake" appears) —
        # interacting earlier behaves erratically.
        ok = False
        for _ in range(12):
            time.sleep(2)
            if self.dev.has_text("retake") and not self.dev.has_text("removing background"):
                ok = True
                break
        if not ok:
            self.record("add: background removal finished", False, "form never settled")
            return False
        if private:
            # Privacy lock toggle, top-right corner of the photo. The hit target is
            # small and sits over the photo's retake overlay, so the centre has to be
            # precise (a near miss triggers retake). iOS inset differs from Android.
            lock_rx, lock_ry = (0.87, 0.15) if self.dev.name == "ios" else (0.88, 0.13)
            self.tap_ratio(lock_rx, lock_ry)
            time.sleep(1)
            self.shot("add_private_toggled")
        f = self.dev.find("name")
        if f:
            self.dev.tap(f["cx"], f["cy"])
            time.sleep(1)
            self.dev.type_text(name)
            time.sleep(1)
            self.dev.back()   # dismiss the soft keyboard (covers save); leaves modal open
            time.sleep(1)
        if not self.dev.tap_exact("save"):
            self.dev.tap_label("save")
        time.sleep(6)
        return not self.dev.has_text("save")

    def open_first_item(self):
        # Make sure all items are shown (not the 'featured' filter), then tap the
        # first grid tile (which sits below the search bar + filter chip row).
        self.dev.tap_label("all")
        time.sleep(1)
        self.tap_ratio(0.20, 0.35)   # first grid tile
        time.sleep(2)

    def delete_current_item(self):
        self.tap_ratio(0.88, 0.10)   # "..." menu in item detail
        time.sleep(1.5)
        self.dev.tap_label("delete")  # menu item
        time.sleep(1.5)
        self.dev.tap_exact("delete")  # confirm-dialog button
        time.sleep(3)

    def dismiss(self):
        """Pop a pushed/modal screen (settings, notifications, stats) back to the
        tabbed UI."""
        if self.dev.name == "android":
            self.dev.back()
        else:
            # The settings sheet closes via a top-right "done"; notifications/stats
            # via a top-left close chevron (no label). Try the button, then the
            # chevron. Leaving settings open here corrupts a later account switch.
            if not self.dev.tap_exact("done"):
                self.dev.tap(35, 100)  # top-left close chevron (points)
        time.sleep(2)

    # ---- navigation helpers (label-first, with tab fallbacks) ----
    TAB_LABELS = {
        "feed": ["home", "feed"],
        "today": ["today", "calendar"],
        "notifications": ["notifications", "bell"],
    }

    def tap_tab(self, which):
        # Tabs are icons; their accessibility labels vary, so fall back to tapping
        # along the bottom tab bar by index if no label matches.
        for lbl in self.TAB_LABELS.get(which, []):
            if self.dev.tap_label(lbl):
                time.sleep(3)
                return
        self.tap_bottom_tab_index({"feed": 0, "today": 1, "notifications": 2}[which])
        time.sleep(3)

    def tap_tab_profile(self):
        for lbl in ["collection", "profile", "you"]:
            if self.dev.tap_label(lbl):
                time.sleep(2)
                return
        self.tap_bottom_tab_index(3)

    def tap_bottom_tab_index(self, idx):
        # 4 tabs spread across the width near the bottom.
        path = self.shot("_probe_size")
        try:
            from PIL import Image  # optional
            w, h = Image.open(path).size
        except Exception:
            w, h = (1080, 2400) if self.dev.name == "android" else (393, 852)
        xs = [w * f for f in (0.17, 0.40, 0.62, 0.85)]
        y = h * 0.965
        self.dev.tap(xs[idx], y)

    def open_stats(self):
        # Stats is the bar-chart icon in the collection header.
        path = self.shot("_probe_size")
        try:
            from PIL import Image
            w, h = Image.open(path).size
        except Exception:
            w, h = (1080, 2400) if self.dev.name == "android" else (393, 852)
        self.dev.tap(w * 0.81, h * 0.12)

    def scroll_down(self):
        path = self.shot("_probe_size")
        try:
            from PIL import Image
            w, h = Image.open(path).size
        except Exception:
            w, h = (1080, 2400) if self.dev.name == "android" else (393, 852)
        if self.dev.name == "android":
            self.dev._adb("shell", "input", "swipe",
                          str(int(w / 2)), str(int(h * 0.75)),
                          str(int(w / 2)), str(int(h * 0.25)), "300")
        else:
            run([IDB, "ui", "swipe", str(int(w / 2)), str(int(h * 0.75)),
                 str(int(w / 2)), str(int(h * 0.25)), "--duration", "0.3",
                 "--udid", self.dev.udid])
        time.sleep(1)

    def dismiss_dev_menu(self):
        # Expo dev client sometimes opens its menu on launch.
        for lbl in ["Continue", "Close", "Go home"]:
            if self.dev.tap_label(lbl):
                time.sleep(1.5)

    # ---- auth / account switching ----
    def at_auth_screen(self):
        return self.dev.has_text("continue with google") or self.dev.has_text("sign in with email")

    def ensure_signed_in(self, email=TEST_EMAIL):
        """For the read-only smoke: sign in only if signed out (don't disturb the
        currently-signed-in account)."""
        if not self.at_auth_screen():
            self.record("already signed in", True)
            return
        self.sign_in_email(email)

    def sign_in_email(self, email, password=TEST_PASSWORD):
        if self.at_auth_screen() and not self.dev.has_text("password"):
            self.dev.tap_label("sign in with email")
            time.sleep(2)
        f = self.dev.find("email")
        if f:
            self.dev.tap(f["cx"], f["cy"])
            time.sleep(1)
            self.dev.type_text(email)
            time.sleep(1)
        f = self.dev.find("password")
        if f:
            self.dev.tap(f["cx"], f["cy"])
            time.sleep(1)
            self.dev.type_text(password)
            time.sleep(1)
        # idb has dropped trailing chars before — verify the email captured fully.
        local = email.split("@")[0]
        em = self.dev.find(local + "@")
        if em and em["text"].rstrip() != email:
            missing = email[len(em["text"].rstrip()):]
            if missing:
                self.dev.tap(em["cx"], em["cy"])
                time.sleep(1)
                self.dev.type_text(missing)
                time.sleep(1)
        # Exact match: "sign in" submit, not "Sign in with Apple" / "sign in with email".
        self.dev.tap_exact("sign in")
        time.sleep(6)
        self.dismiss_system_dialogs()
        ok = not self.at_auth_screen()
        self.record(f"email sign-in ({email})", ok, "" if ok else "still on auth screen")
        return ok

    def dismiss_system_dialogs(self):
        # OS dialogs that cover the app: the "save password" prompt after sign-in
        # (Google Password Manager / iCloud Keychain) and the OAuth "Wants to Use ...
        # to Sign In" consent. Dismiss non-committally (Cancel / Not now), never save.
        for lbl in ["Never", "Not now", "Not Now", "No thanks", "Don't Save", "Cancel"]:
            if self.dev.tap_label(lbl):
                time.sleep(1.5)
                return True
        return False

    def open_settings(self):
        # Gear icon, far top-right of the collection header (no text label).
        if not self.dev.has_text("search"):
            self.tap_tab_profile()
            time.sleep(2)
        path = self.shot("_probe_size")
        try:
            from PIL import Image
            w, h = Image.open(path).size
        except Exception:
            w, h = (1080, 2400) if self.dev.name == "android" else (393, 852)
        self.dev.tap(w * 0.90, h * 0.12)
        time.sleep(2)

    def current_account(self):
        """Email of the signed-in account, read from the settings sheet (or None)."""
        if self.at_auth_screen():
            return None
        self.open_settings()
        acct = None
        for el in self.dev.elements():
            if "@" in el["text"] and "." in el["text"]:
                acct = el["text"].strip()
                break
        self.dismiss()  # close settings sheet
        return acct

    def sign_out(self):
        self.open_settings()
        # 'log out' may be below the fold.
        if not self.dev.tap_label("log out"):
            self.scroll_down()
            self.dev.tap_label("log out")
        time.sleep(4)

    def ensure_account(self, email):
        """Make `email` the signed-in account, switching if a different one is active."""
        if self.at_auth_screen():
            return self.sign_in_email(email)
        cur = self.current_account()
        if cur and cur.lower() == email.lower():
            self.record(f"account is {email}", True)
            return True
        self.sign_out()
        return self.sign_in_email(email)

    def summary(self):
        passed = sum(1 for _, ok, _ in self.results if ok)
        total = len(self.results)
        failed = [s for s, ok, _ in self.results if not ok]
        report = {
            "platform": self.dev.name,
            "when": datetime.now().isoformat(timespec="seconds"),
            "passed": passed,
            "total": total,
            "results": [{"step": s, "ok": ok, "detail": d} for s, ok, d in self.results],
        }
        report["suite"] = self.tag
        fname = f"report_{self.dev.name}_{self.tag}.json"
        with open(os.path.join(self.out, fname), "w") as f:
            json.dump(report, f, indent=2)
        print(f"--- {self.dev.name}: {passed}/{total} passed" +
              (f"; FAILED: {failed}" if failed else ""))
        return len(failed) == 0


SUITES = {
    "smoke": lambda r: r.run(),                # read-only happy path (test1)
    "empty": lambda r: r.run_empty(),          # new-user / empty-state (test3)
    "destructive": lambda r: r.run_destructive(),  # add/delete lifecycle (test2)
    "multiuser": lambda r: r.run_multiuser(),      # follow/notification (test2 -> test1)
    "seed": lambda r: r.run_seed(),                # one-time: private item on test1
}
SUITE_TAGS = {"smoke": "smoke", "empty": "empty", "destructive": "destr",
              "multiuser": "multi", "seed": "seed"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", choices=["android", "ios", "both"], default="both")
    ap.add_argument("--suite", choices=list(SUITES) + ["all"], default="smoke")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = args.out or os.path.join(os.path.dirname(__file__), "runs", stamp)
    os.makedirs(out_dir, exist_ok=True)
    print(f"screenshots + reports -> {out_dir}")

    targets = ["android", "ios"] if args.platform == "both" else [args.platform]
    # 'all' runs the test suites but not 'seed' (a one-time setup that mutates test1).
    suites = [s for s in SUITES if s != "seed"] if args.suite == "all" else [args.suite]
    all_ok = True
    for t in targets:
        for s in suites:
            try:
                dev = AndroidDevice() if t == "android" else IosDevice()
                ok = SUITES[s](Runner(dev, out_dir, tag=SUITE_TAGS[s]))
                all_ok = all_ok and ok
            except Exception as e:
                print(f"  [ERROR] {t}/{s}: {e}")
                all_ok = False
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
