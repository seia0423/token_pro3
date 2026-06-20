export const positionLabels = {
  1: "CG",
  2: "Right SG",
  3: "Left SG",
  4: "PM",
  5: "Right WG",
  6: "Left WG",
  7: "ST",
  8: "Defensive Changer",
  9: "Offensive Changer",
  10: "Free CT",
  11: "Libero",
  12: "Right WB",
  13: "Left WB",
  14: "Anchor",
  15: "Right IW",
  16: "Left IW",
  17: "Shadow",
  20: "All-rounder",
};

export const formations = {
  f313: {
    label: "3-1-3",
    op: ["11", "14", "10", "15", "16", "17"],
    slots: [
      { key: "back_right", label: "Back Right", allowed: ["2"] },
      { key: "back_center", label: "Back Center", allowed: ["1", "11"] },
      { key: "back_left", label: "Back Left", allowed: ["3"] },
      { key: "midfield_center", label: "Midfield Center", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "Front Right", allowed: ["5"] },
      { key: "front_left", label: "Front Left", allowed: ["6"] },
      { key: "front_center", label: "Front Center", allowed: ["7", "17"] },
    ],
  },
  f223: {
    label: "2-2-3",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_center_right", label: "Back Center Right", allowed: ["1", "11"] },
      { key: "back_center_left", label: "Back Center Left", allowed: ["1", "11"] },
      { key: "midfield_right", label: "Midfield Right", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "Midfield Left", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "Front Right", allowed: ["5"] },
      { key: "front_left", label: "Front Left", allowed: ["6"] },
      { key: "front_center", label: "Front Center", allowed: ["7", "17"] },
    ],
  },
  f232: {
    label: "2-3-2",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_center_right", label: "Back Center Right", allowed: ["1", "11"] },
      { key: "back_center_left", label: "Back Center Left", allowed: ["1", "11"] },
      { key: "midfield_right", label: "Midfield Right", allowed: ["12"] },
      { key: "midfield_center", label: "Midfield Center", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "Midfield Left", allowed: ["13"] },
      { key: "front_right", label: "Front Right", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "Front Left", allowed: ["7", "17", "5", "6"] },
    ],
  },
  f331: {
    label: "3-3-1",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_right", label: "Back Right", allowed: ["2"] },
      { key: "back_center", label: "Back Center", allowed: ["1", "11"] },
      { key: "back_left", label: "Back Left", allowed: ["3"] },
      { key: "midfield_right", label: "Midfield Right", allowed: ["12"] },
      { key: "midfield_center", label: "Midfield Center", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "Midfield Left", allowed: ["13"] },
      { key: "front_center", label: "Front Center", allowed: ["7"] },
    ],
  },
  f241: {
    label: "2-4-1",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_center_right", label: "Back Center Right", allowed: ["1", "11"] },
      { key: "back_center_left", label: "Back Center Left", allowed: ["1", "11"] },
      { key: "midfield_wide_right", label: "Midfield Wide Right", allowed: ["12"] },
      { key: "midfield_center_right", label: "Midfield Center Right", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_center_left", label: "Midfield Center Left", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_wide_left", label: "Midfield Wide Left", allowed: ["13"] },
      { key: "front_center", label: "Front Center", allowed: ["7"] },
    ],
  },
  f322: {
    label: "3-2-2",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_right", label: "Back Right", allowed: ["2"] },
      { key: "back_center", label: "Back Center", allowed: ["1", "11"] },
      { key: "back_left", label: "Back Left", allowed: ["3"] },
      { key: "midfield_right", label: "Midfield Right", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_left", label: "Midfield Left", allowed: ["4", "15", "16", "10", "14"] },
      { key: "front_right", label: "Front Right", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "Front Left", allowed: ["7", "17", "5", "6"] },
    ],
  },
  f421: {
    label: "4-2-1",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_wide_right", label: "Back Wide Right", allowed: ["2"] },
      { key: "back_center_right", label: "Back Center Right", allowed: ["1", "11"] },
      { key: "back_center_left", label: "Back Center Left", allowed: ["1", "11"] },
      { key: "back_wide_left", label: "Back Wide Left", allowed: ["3"] },
      { key: "midfield_right", label: "Midfield Right", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_left", label: "Midfield Left", allowed: ["4", "15", "16", "10", "14"] },
      { key: "front_center", label: "Front Center", allowed: ["7"] },
    ],
  },
  f412: {
    label: "4-1-2",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_wide_right", label: "Back Wide Right", allowed: ["2"] },
      { key: "back_center_right", label: "Back Center Right", allowed: ["1", "11"] },
      { key: "back_center_left", label: "Back Center Left", allowed: ["1", "11"] },
      { key: "back_wide_left", label: "Back Wide Left", allowed: ["3"] },
      { key: "midfield_center", label: "Midfield Center", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "Front Right", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "Front Left", allowed: ["7", "17", "5", "6"] },
    ],
  },
};

const opReplacementFor = {
  10: "4",
  11: "1",
  14: "4",
  15: "5",
  16: "6",
  17: "7",
};

export function formationByKey(key = "f313") {
  return formations[key] ? { key, ...formations[key] } : { key: "f313", ...formations.f313 };
}

export function slotCandidates(slot, formation) {
  const baseCode = slot.allowed[0];
  const opCandidates = formation.op.filter((code) => {
    const replacement = opReplacementFor[code];
    return replacement && slot.allowed.includes(replacement) && !slot.allowed.includes(code);
  });
  const rawCandidates = [...slot.allowed, ...opCandidates];

  return rawCandidates
    .filter((code) => !opReplacementFor[code] || formation.op.includes(code) || slot.allowed.includes(code))
    .map((code, index) => {
      const isOp = Boolean(opReplacementFor[code]) && !slot.allowed.includes(code);
      return {
        code,
        kind: index === 0 ? "base" : isOp ? "op" : "alternate",
        replacementFor: index === 0 ? "" : opReplacementFor[code] || baseCode,
        priority: index === 0 ? 1 : isOp ? 0.96 : 0.97,
      };
    });
}

export function slotLane(slot) {
  if (slot.key.startsWith("front")) return "front";
  if (slot.key.startsWith("midfield")) return "midfield";
  return "back";
}
