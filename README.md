# NDLOCR Digital Page

A browser-based inspection and correction viewer for NDLOCR-Lite and NDLOCR CLI XML. It places recognized vertical text and detected layout regions over the corresponding scan while keeping the OCR data editable and exportable.

The included sample is frame 11 and frame 26 from *Tai-Japanese Dictionary* (`台日大辭典`, NDL PID 1218326). Frame 26 contains 95 recognized text lines and 119 detected ruby regions.

## Features

- Facsimile, OCR overlay, reconstructed-text, and Lite/CLI comparison views
- Original XML coordinates and reading order
- Text, layout, and ruby-region overlays
- Search and confidence filtering
- Per-line OCR correction
- Corrected XML export
- Lite/CLI result switching for frames 11 and 26
- Character-level difference highlighting and review-only filtering
- CSV export with explicit review markers for every non-exact comparison
- Selectable CLI ruby readings
- Responsive desktop and compact layouts

## Run locally

From the repository root:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765/
```

No build step or package installation is required.

## Project structure

```text
viewer/                         Static viewer application
samples/1218326/images/         Original NDL page images
samples/1218326/ocr/            NDLOCR-Lite XML, JSON, and text output
samples/1218326/ocr-cli/        NDLOCR CLI XML, text, and separated page images
```

## OCR provenance and limitations

The Lite sample OCR was generated locally with NDLOCR-Lite 1.3.0. NDLOCR-Lite identifies ruby regions in frame 26, but those XML `BLOCK` elements contain coordinates only. They do not include recognized ruby strings or explicit associations with base characters.

Frame 26 was also processed with NDLOCR CLI on a Tesla V100. The CLI separated the scan into left and right page images and produced 113 ruby regions with recognized strings. The viewer exposes each CLI page separately because its XML coordinates refer to those generated page images, not the original full scan.

The comparison view aligns Lite and CLI text lines, including limited one-to-two line segmentation differences. It falls back to order-independent assignment when the two engines disagree about reading order. Exact normalized matches are shown as consensus; every character difference and every unmatched line is marked for review. Agreement is useful supporting evidence, but it is not a substitute for checking the scan because both models can make the same error.

The viewer does not run OCR itself. It reads existing OCR XML and lets a reviewer inspect and correct recognized line and ruby text.

## Source material

Source: National Diet Library Digital Collections, *Tai-Japanese Dictionary* (`台日大辭典`), PID 1218326:

- [Frame 11](https://dl.ndl.go.jp/pid/1218326/1/11)
- [Frame 26](https://dl.ndl.go.jp/pid/1218326/1/26)

NDL marks this item `pdm` / `インターネット公開（保護期間満了）`, meaning its copyright protection has expired. The sample images are therefore public-domain source material. The NDL requests source attribution when its digitized content is reused.

The separately tested PID 869413 is intentionally excluded because NDL publishes it under a copyright adjudication rather than marking it public domain.

## License

The viewer code is licensed under the MIT License. The sample NDL images are public-domain source material and are not covered by the software license. NDLOCR-Lite is not vendored in this repository and remains subject to its own license.
