const PAGE_CONFIGS = {
  "1218326-26": {
    pid: "1218326",
    frame: "26",
    title: "Tai-Japanese Dictionary",
    defaultOcr: "lite",
    ocrSources: {
      lite: {
        label: "NDLOCR-Lite · Full scan",
        imagePath: "../samples/1218326/images/1218326_R0000026.jpg",
        xmlPath: "../samples/1218326/ocr/1218326_R0000026.xml",
        exportName: "1218326_R0000026_lite_corrected.xml"
      },
      "cli-l": {
        label: "NDLOCR CLI · Left crop",
        imagePath: "../samples/1218326/ocr-cli/frame26/pred_img/input_L.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame26/xml/input.sorted.xml",
        pageImageName: "input_L.jpg",
        exportName: "1218326_R0000026_cli_left_corrected.xml"
      },
      "cli-r": {
        label: "NDLOCR CLI · Right crop",
        imagePath: "../samples/1218326/ocr-cli/frame26/pred_img/input_R.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame26/xml/input.sorted.xml",
        pageImageName: "input_R.jpg",
        exportName: "1218326_R0000026_cli_right_corrected.xml"
      }
    }
  },
  "1218326-11": {
    pid: "1218326",
    frame: "11",
    title: "Tai-Japanese Dictionary",
    defaultOcr: "lite",
    ocrSources: {
      lite: {
        label: "NDLOCR-Lite · Full scan",
        imagePath: "../samples/1218326/images/1218326_R0000011.jpg",
        xmlPath: "../samples/1218326/ocr/1218326_R0000011.xml",
        exportName: "1218326_R0000011_lite_corrected.xml"
      }
    }
  }
};

const initialState = new URLSearchParams(window.location.search);
const requestedPage = `${initialState.get("pid")}-${initialState.get("frame")}`;
const activePage = PAGE_CONFIGS[requestedPage] || PAGE_CONFIGS["1218326-26"];
const requestedOcr = initialState.get("ocr") || activePage.defaultOcr;
const activeOcrKey = activePage.ocrSources[requestedOcr] ? requestedOcr : activePage.defaultOcr;
const activeOcr = activePage.ocrSources[activeOcrKey];

const page = document.querySelector("#page");
const viewport = document.querySelector("#viewport");
const scan = document.querySelector("#scan");
const textLayer = document.querySelector("#text-layer");
const structureLayer = document.querySelector("#structure-layer");
const loading = document.querySelector("#loading");
const summary = document.querySelector("#summary");
const searchInput = document.querySelector("#search");
const threshold = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#threshold-value");
const showRegions = document.querySelector("#show-regions");
const showOrder = document.querySelector("#show-order");
const lineEditor = document.querySelector("#line-editor");
const emptySelection = document.querySelector("#empty-selection");
const lineText = document.querySelector("#line-text");
const pageSelect = document.querySelector("#page-select");
const ocrSelect = document.querySelector("#ocr-select");

let xmlDocument;
let pageWidth = 3902;
let pageHeight = 2855;
let zoom = 1;
let selectedLine = null;
let lines = [];
let textLineCount = 0;
let rubyBlockCount = 0;
let rubyReadingCount = 0;

function numberAttribute(element, name, fallback = 0) {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function classifyType(type) {
  if (type === "本文") return "type-main";
  if (type === "ルビ") return "type-ruby";
  if (type === "割注" || type === "頭注" || type === "キャプション") return "type-note";
  return "type-other";
}

function typeLabel(type) {
  const labels = {
    "本文": "Body text",
    "割注": "Interlinear note",
    "頭注": "Headnote",
    "キャプション": "Caption",
    "広告文字": "Advertisement",
    "ルビ": "Ruby"
  };
  return labels[type] || type || "Text";
}

function percentage(value, total) {
  return `${(value / total) * 100}%`;
}

function makeLine(element) {
  const x = numberAttribute(element, "X");
  const y = numberAttribute(element, "Y");
  const width = numberAttribute(element, "WIDTH");
  const height = numberAttribute(element, "HEIGHT");
  const confidence = numberAttribute(element, "CONF");
  const hasOrder = element.hasAttribute("ORDER");
  const order = numberAttribute(element, "ORDER", 999999);
  const type = element.getAttribute("TYPE") || "";
  const value = element.getAttribute("STRING") || "";
  const vertical = height > width;

  const node = document.createElement("div");
  node.className = `ocr-line ${vertical ? "vertical" : "horizontal"} ${classifyType(type)}`;
  node.style.left = percentage(x, pageWidth);
  node.style.top = percentage(y, pageHeight);
  node.style.width = percentage(width, pageWidth);
  node.style.height = percentage(height, pageHeight);
  node.dataset.confidence = confidence;
  node.dataset.order = order;
  node.dataset.search = value.toLocaleLowerCase();
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  const orderLabel = hasOrder ? `, order ${order}` : "";
  const valueLabel = value || "No recognized text";
  node.setAttribute("aria-label", `${typeLabel(type)}${orderLabel}: ${valueLabel}`);

  const string = document.createElement("span");
  string.className = "line-string";
  string.textContent = value;
  node.append(string);

  const badge = document.createElement("span");
  badge.className = "order-badge";
  if (hasOrder) {
    badge.textContent = order;
    node.append(badge);
  }

  const line = { element, node, string, x, y, width, height, confidence, order, hasOrder, type, vertical };
  node.addEventListener("click", () => selectLine(line));
  node.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLine(line);
    }
  });
  return line;
}

function selectLine(line) {
  selectedLine?.node.classList.remove("is-selected");
  selectedLine = line;
  selectedLine.node.classList.add("is-selected");
  emptySelection.hidden = true;
  lineEditor.hidden = false;
  document.querySelector("#selection-type").textContent = typeLabel(line.type);
  document.querySelector("#selection-confidence").textContent = `${line.confidence.toFixed(3)} confidence`;
  document.querySelector("#selection-order").textContent = line.hasOrder ? line.order : "Not assigned";
  document.querySelector("#selection-direction").textContent = line.vertical ? "Vertical" : "Horizontal";
  document.querySelector("#selection-bounds").textContent = `${line.x}, ${line.y}, ${line.width} × ${line.height}`;
  lineText.value = line.element.getAttribute("STRING") || "";
}

function renderStructure(root) {
  structureLayer.setAttribute("viewBox", `0 0 ${pageWidth} ${pageHeight}`);
  structureLayer.replaceChildren();

  root.querySelectorAll("TEXTBLOCK SHAPE POLYGON").forEach(element => {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", (element.getAttribute("POINTS") || "").replaceAll(",", " "));
    structureLayer.append(polygon);
  });

  root.querySelectorAll("BLOCK").forEach(element => {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", element.getAttribute("X") || 0);
    rect.setAttribute("y", element.getAttribute("Y") || 0);
    rect.setAttribute("width", element.getAttribute("WIDTH") || 0);
    rect.setAttribute("height", element.getAttribute("HEIGHT") || 0);
    rect.dataset.type = element.getAttribute("TYPE") || "";
    structureLayer.append(rect);
  });
}

function updateFontSizes() {
  const scale = page.getBoundingClientRect().width / pageWidth;
  lines.forEach(line => {
    const sourceSize = line.vertical ? line.width * 0.72 : line.height * 0.72;
    line.node.style.fontSize = `${Math.max(5, sourceSize * scale)}px`;
  });
}

function updateVisibility() {
  const minimum = Number(threshold.value);
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visible = 0;
  let matches = 0;

  lines.forEach(line => {
    const below = line.confidence < minimum;
    const match = query.length > 0 && line.node.dataset.search.includes(query);
    line.node.classList.toggle("below-threshold", below);
    line.node.classList.toggle("is-match", match && !below);
    if (!below) visible += 1;
    if (match && !below) matches += 1;
  });

  const matchText = query ? ` · ${matches} matches` : "";
  summary.textContent = `${visible}/${lines.length} regions · ${textLineCount} lines · ${rubyBlockCount} ruby regions · ${rubyReadingCount} readings${matchText}`;
}

function applyZoom(nextZoom) {
  zoom = Math.min(2.5, Math.max(0.5, nextZoom));
  const gutter = window.matchMedia("(max-width: 920px)").matches ? 28 : 56;
  const availableWidth = Math.max(180, viewport.clientWidth - gutter);
  const availableHeight = Math.max(280, viewport.clientHeight - gutter);
  const widthForHeight = Math.max(180, availableHeight * (pageWidth / pageHeight));
  const baseWidth = Math.min(1200, availableWidth, widthForHeight);
  page.style.width = `${Math.round(baseWidth * zoom)}px`;
  document.querySelector("#zoom-label").textContent = `${Math.round(zoom * 100)}%`;
  requestAnimationFrame(updateFontSizes);
}

function setMode(mode) {
  page.classList.remove("mode-facsimile", "mode-overlay", "mode-text");
  page.classList.add(`mode-${mode}`);
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

function exportXml() {
  const serialized = new XMLSerializer().serializeToString(xmlDocument);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = activeOcr.exportName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadXml() {
  try {
    document.querySelector("#document-name").textContent = activePage.title;
    document.querySelector("#frame-name").textContent = `Frame ${activePage.frame}`;
    pageSelect.value = `${activePage.pid}-${activePage.frame}`;
    ocrSelect.replaceChildren(...Object.entries(activePage.ocrSources).map(([value, source]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = source.label;
      return option;
    }));
    ocrSelect.value = activeOcrKey;
    scan.src = activeOcr.imagePath;
    scan.alt = `${activeOcr.label} page from ${activePage.title}`;

    const response = await fetch(activeOcr.xmlPath);
    if (!response.ok) throw new Error(`XML request failed: ${response.status}`);
    const source = await response.text();
    xmlDocument = new DOMParser().parseFromString(source, "application/xml");
    if (xmlDocument.querySelector("parsererror")) throw new Error("The OCR XML could not be parsed.");

    const pageElements = [...xmlDocument.querySelectorAll("PAGE")];
    const pageElement = activeOcr.pageImageName
      ? pageElements.find(element => element.getAttribute("IMAGENAME") === activeOcr.pageImageName)
      : pageElements[0];
    if (!pageElement) throw new Error("The selected page was not found in the OCR XML.");
    pageWidth = numberAttribute(pageElement, "WIDTH", pageWidth);
    pageHeight = numberAttribute(pageElement, "HEIGHT", pageHeight);
    page.style.aspectRatio = `${pageWidth} / ${pageHeight}`;

    const textElements = [...pageElement.querySelectorAll("LINE")];
    const rubyElements = [...pageElement.querySelectorAll('BLOCK[TYPE="ルビ"]')];
    textLineCount = textElements.length;
    rubyBlockCount = rubyElements.length;
    rubyReadingCount = rubyElements.filter(element => (element.getAttribute("STRING") || "").length > 0).length;
    lines = [...textElements.map(makeLine).sort((a, b) => a.order - b.order), ...rubyElements.map(makeLine)];
    textLayer.replaceChildren(...lines.map(line => line.node));
    renderStructure(pageElement);
    updateVisibility();
    applyZoom(1);
    loading.hidden = true;
  } catch (error) {
    loading.textContent = error.message;
    loading.classList.add("is-error");
  }
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

showRegions.addEventListener("change", () => page.classList.toggle("show-regions", showRegions.checked));
showOrder.addEventListener("change", () => page.classList.toggle("show-order", showOrder.checked));
searchInput.addEventListener("input", updateVisibility);
threshold.addEventListener("input", () => {
  thresholdValue.value = Number(threshold.value).toFixed(2);
  updateVisibility();
});
lineText.addEventListener("input", () => {
  if (!selectedLine) return;
  selectedLine.element.setAttribute("STRING", lineText.value);
  selectedLine.string.textContent = lineText.value;
  selectedLine.node.dataset.search = lineText.value.toLocaleLowerCase();
  updateVisibility();
});
document.querySelector("#zoom-out").addEventListener("click", () => applyZoom(zoom - 0.25));
document.querySelector("#zoom-reset").addEventListener("click", () => applyZoom(1));
document.querySelector("#zoom-in").addEventListener("click", () => applyZoom(zoom + 0.25));
document.querySelector("#export-xml").addEventListener("click", exportXml);
pageSelect.addEventListener("change", () => {
  const [pid, frame] = pageSelect.value.split("-");
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("pid", pid);
  nextUrl.searchParams.set("frame", frame);
  window.location.assign(nextUrl);
});
ocrSelect.addEventListener("change", () => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("ocr", ocrSelect.value);
  window.location.assign(nextUrl);
});

new ResizeObserver(() => updateFontSizes()).observe(page);
window.addEventListener("resize", () => applyZoom(zoom));

const initialMode = initialState.get("view");
if (["facsimile", "overlay", "text"].includes(initialMode)) setMode(initialMode);
if (initialState.get("regions") === "1") {
  showRegions.checked = true;
  page.classList.add("show-regions");
}
if (initialState.get("order") === "1") {
  showOrder.checked = true;
  page.classList.add("show-order");
}

loadXml();
