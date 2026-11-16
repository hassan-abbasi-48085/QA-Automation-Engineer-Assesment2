// Helpers that turn Gherkin data tables into typed values.

const NUMBER = /^-?\d+(\.\d+)?$/;

/** A table cell that looks like a number becomes a number; anything else stays a string. */
export function parseValue(cell) {
  return NUMBER.test(cell) ? Number(cell) : cell;
}

/** | sku | quantity | unitPrice | table -> order items. */
export function parseItems(table) {
  return table.hashes().map((row) => ({
    sku: row.sku,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
  }));
}
