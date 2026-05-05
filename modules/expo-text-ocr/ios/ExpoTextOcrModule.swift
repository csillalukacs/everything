import ExpoModulesCore
import Vision
import UIKit

public class ExpoTextOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTextOcr")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri) else {
        promise.reject("E_INVALID_URI", "Invalid URI: \(uri)")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        let image: UIImage?
        if url.isFileURL {
          image = UIImage(contentsOfFile: url.path)
        } else if let data = try? Data(contentsOf: url) {
          image = UIImage(data: data)
        } else {
          image = nil
        }

        guard let cgImage = image?.cgImage else {
          promise.reject("E_IMAGE_LOAD", "Could not load image: \(uri)")
          return
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
          try handler.perform([request])
          let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
          promise.resolve(lines.joined(separator: "\n"))
        } catch {
          promise.reject("E_OCR", error.localizedDescription)
        }
      }
    }
  }
}
