(function initializeOcrCompare(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.OcrCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createOcrCompare() {
  const GAP_SCORE = -0.45;
  const CLOSE_THRESHOLD = 0.9;

  function normalizeText(value) {
    return String(value || "").normalize("NFC").replace(/\s+/gu, "");
  }

  function editDistance(leftValue, rightValue) {
    const left = Array.from(normalizeText(leftValue));
    const right = Array.from(normalizeText(rightValue));
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
        current[rightIndex] = Math.min(
          previous[rightIndex] + 1,
          current[rightIndex - 1] + 1,
          substitution
        );
      }
      previous = current;
    }

    return previous[right.length];
  }

  function similarity(leftValue, rightValue) {
    const left = normalizeText(leftValue);
    const right = normalizeText(rightValue);
    const longest = Math.max(Array.from(left).length, Array.from(right).length);
    if (longest === 0) return 1;
    return 1 - editDistance(left, right) / longest;
  }

  function classify(left, right, score) {
    if (left.length === 0 || right.length === 0) return "missing";
    if (normalizeText(left.join("")) === normalizeText(right.join(""))) return "exact";
    return score >= CLOSE_THRESHOLD ? "close" : "conflict";
  }

  function matchScore(left, right) {
    const score = similarity(left.join(""), right.join(""));
    if (score < 0.35) return -1.2;
    const mergePenalty = Math.max(0, left.length + right.length - 2) * 0.12;
    return score * 2 - 0.7 - mergePenalty;
  }

  function alignSequential(leftLines, rightLines) {
    const left = leftLines.filter(line => normalizeText(line).length > 0);
    const right = rightLines.filter(line => normalizeText(line).length > 0);
    const table = Array.from({ length: left.length + 1 }, () =>
      Array.from({ length: right.length + 1 }, () => ({ score: Number.NEGATIVE_INFINITY, step: null }))
    );
    table[0][0] = { score: 0, step: null };

    function consider(i, j, previousI, previousJ, leftCount, rightCount, addedScore) {
      const candidate = table[previousI][previousJ].score + addedScore;
      if (candidate > table[i][j].score) {
        table[i][j] = { score: candidate, step: { previousI, previousJ, leftCount, rightCount } };
      }
    }

    for (let i = 0; i <= left.length; i += 1) {
      for (let j = 0; j <= right.length; j += 1) {
        if (i === 0 && j === 0) continue;
        if (i > 0) consider(i, j, i - 1, j, 1, 0, GAP_SCORE);
        if (j > 0) consider(i, j, i, j - 1, 0, 1, GAP_SCORE);
        if (i > 0 && j > 0) {
          consider(i, j, i - 1, j - 1, 1, 1, matchScore([left[i - 1]], [right[j - 1]]));
        }
        if (i > 0 && j > 1) {
          consider(i, j, i - 1, j - 2, 1, 2, matchScore([left[i - 1]], right.slice(j - 2, j)));
        }
        if (i > 1 && j > 0) {
          consider(i, j, i - 2, j - 1, 2, 1, matchScore(left.slice(i - 2, i), [right[j - 1]]));
        }
      }
    }

    const rows = [];
    let i = left.length;
    let j = right.length;
    while (i > 0 || j > 0) {
      const step = table[i][j].step;
      if (!step) break;
      const leftGroup = left.slice(i - step.leftCount, i);
      const rightGroup = right.slice(j - step.rightCount, j);
      const score = leftGroup.length && rightGroup.length
        ? similarity(leftGroup.join(""), rightGroup.join(""))
        : 0;
      rows.push({
        left: leftGroup,
        right: rightGroup,
        similarity: score,
        status: classify(leftGroup, rightGroup, score)
      });
      i = step.previousI;
      j = step.previousJ;
    }

    return rows.reverse();
  }

  function minimumCostAssignment(costs) {
    const rowCount = costs.length;
    const columnCount = costs[0]?.length || 0;
    const rowPotential = Array(rowCount + 1).fill(0);
    const columnPotential = Array(columnCount + 1).fill(0);
    const matchedRow = Array(columnCount + 1).fill(0);
    const path = Array(columnCount + 1).fill(0);

    for (let row = 1; row <= rowCount; row += 1) {
      matchedRow[0] = row;
      let column = 0;
      const minimum = Array(columnCount + 1).fill(Number.POSITIVE_INFINITY);
      const used = Array(columnCount + 1).fill(false);
      do {
        used[column] = true;
        const currentRow = matchedRow[column];
        let delta = Number.POSITIVE_INFINITY;
        let nextColumn = 0;
        for (let candidate = 1; candidate <= columnCount; candidate += 1) {
          if (used[candidate]) continue;
          const reduced = costs[currentRow - 1][candidate - 1] - rowPotential[currentRow] - columnPotential[candidate];
          if (reduced < minimum[candidate]) {
            minimum[candidate] = reduced;
            path[candidate] = column;
          }
          if (minimum[candidate] < delta) {
            delta = minimum[candidate];
            nextColumn = candidate;
          }
        }
        for (let candidate = 0; candidate <= columnCount; candidate += 1) {
          if (used[candidate]) {
            rowPotential[matchedRow[candidate]] += delta;
            columnPotential[candidate] -= delta;
          } else {
            minimum[candidate] -= delta;
          }
        }
        column = nextColumn;
      } while (matchedRow[column] !== 0);

      do {
        const previous = path[column];
        matchedRow[column] = matchedRow[previous];
        column = previous;
      } while (column !== 0);
    }

    const assignment = Array(rowCount).fill(-1);
    for (let column = 1; column <= columnCount; column += 1) {
      if (matchedRow[column] > 0) assignment[matchedRow[column] - 1] = column - 1;
    }
    return assignment;
  }

  function alignUnordered(left, right) {
    if (left.length === 0 || right.length === 0) {
      return [
        ...left.map(text => ({ left: [text], right: [], similarity: 0, status: "missing" })),
        ...right.map(text => ({ left: [], right: [text], similarity: 0, status: "missing" }))
      ];
    }
    const leftIsSmaller = left.length <= right.length;
    const rows = leftIsSmaller ? left : right;
    const columns = leftIsSmaller ? right : left;
    const costs = rows.map((rowText, rowIndex) => columns.map((columnText, columnIndex) => {
      const positionPenalty = Math.abs(
        rowIndex / Math.max(1, rows.length - 1) - columnIndex / Math.max(1, columns.length - 1)
      ) * 0.01;
      return 1 - similarity(rowText, columnText) + positionPenalty;
    }));
    const assignment = minimumCostAssignment(costs);
    const usedColumns = new Set(assignment);
    const aligned = assignment.map((columnIndex, rowIndex) => {
      const leftIndex = leftIsSmaller ? rowIndex : columnIndex;
      const rightIndex = leftIsSmaller ? columnIndex : rowIndex;
      const score = similarity(left[leftIndex], right[rightIndex]);
      return {
        left: [left[leftIndex]],
        right: [right[rightIndex]],
        similarity: score,
        status: classify([left[leftIndex]], [right[rightIndex]], score),
        sortKey: leftIndex
      };
    });

    columns.forEach((text, columnIndex) => {
      if (usedColumns.has(columnIndex)) return;
      const leftIndex = leftIsSmaller ? null : columnIndex;
      const rightIndex = leftIsSmaller ? columnIndex : null;
      aligned.push({
        left: leftIndex === null ? [] : [text],
        right: rightIndex === null ? [] : [text],
        similarity: 0,
        status: "missing",
        sortKey: leftIndex ?? (rightIndex * left.length / Math.max(1, right.length))
      });
    });

    return aligned.sort((first, second) => first.sortKey - second.sortKey)
      .map(({ sortKey, ...row }) => row);
  }

  function alignLines(leftLines, rightLines) {
    const left = leftLines.filter(line => normalizeText(line).length > 0);
    const right = rightLines.filter(line => normalizeText(line).length > 0);
    const sequential = alignSequential(left, right);
    const unordered = alignUnordered(left, right);
    const missingCount = sequential.filter(row => row.status === "missing").length;
    const expectedDifference = Math.abs(left.length - right.length);
    const sequentialQuality = sequential.reduce((total, row) => total + row.similarity, 0);
    const unorderedQuality = unordered.reduce((total, row) => total + row.similarity, 0);
    return missingCount > expectedDifference + 4 || unorderedQuality > sequentialQuality + 0.3
      ? unordered
      : sequential;
  }

  function diffChars(leftValue, rightValue) {
    const left = Array.from(String(leftValue || ""));
    const right = Array.from(String(rightValue || ""));
    const lengths = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

    for (let i = left.length - 1; i >= 0; i -= 1) {
      for (let j = right.length - 1; j >= 0; j -= 1) {
        lengths[i][j] = left[i] === right[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
      }
    }

    const operations = [];
    function append(type, value) {
      const previous = operations.at(-1);
      if (previous?.type === type) previous.value += value;
      else operations.push({ type, value });
    }

    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        append("equal", left[i]);
        i += 1;
        j += 1;
      } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
        append("delete", left[i]);
        i += 1;
      } else {
        append("insert", right[j]);
        j += 1;
      }
    }
    while (i < left.length) append("delete", left[i++]);
    while (j < right.length) append("insert", right[j++]);
    return operations;
  }

  return { alignLines, diffChars, editDistance, normalizeText, similarity };
});
