import { shuffledRows } from "./shuffle";

describe("shuffledRows", () => {
  const lists = [
    ["a", "b", "c", "d"],
    ["e", "f", "g", "h"],
  ];

  it("makes count rows of length words, no repeats within a row", () => {
    const rows = shuffledRows(lists, 5, 3);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toHaveLength(3);
      expect(new Set(row).size).toBe(3);
    }
  });

  it("draws from every list", () => {
    const seen = new Set(shuffledRows(lists, 50, 4).flat());
    expect(seen).toEqual(new Set(lists.flat()));
  });

  it("caps rows at the pool size", () => {
    expect(shuffledRows([["a", "b"]], 1, 5)[0]).toHaveLength(2);
  });

  it("is deterministic for a given random source", () => {
    const seeded = () => {
      let s = 1;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    };
    expect(shuffledRows(lists, 3, 4, seeded())).toEqual(
      shuffledRows(lists, 3, 4, seeded()),
    );
  });
});
