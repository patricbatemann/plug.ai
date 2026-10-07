export function parseCSV(text: string): {
  headers: string[]
  rows: string[][]
} {
  const records: string[][] = []
  let row: string[] = [],
    field = "",
    quoted = false
  const input = text.replace(/^\uFEFF/, "")
  for (let index = 0; index < input.length; index++) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"'
        index++
      } else if (!field || quoted) quoted = !quoted
      else throw new Error("Invalid quote in CSV field.")
    } else if (character === "," && !quoted) {
      row.push(field.trim())
      field = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index++
      row.push(field.trim())
      if (row.some((value) => value !== "")) records.push(row)
      row = []
      field = ""
    } else field += character
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.")
  row.push(field.trim())
  if (row.some((value) => value !== "")) records.push(row)
  const headers = records.shift() ?? []
  if (
    !headers.length ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Column headers must be non-empty and unique.")
  if (!records.length)
    throw new Error("CSV must contain at least one data row.")
  if (records.some((record) => record.length !== headers.length))
    throw new Error(
      "Every CSV row must have the same number of fields as the header.",
    )
  return { headers, rows: records }
}

export function validateMapping(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
) {
  for (const field of ["timestamp", "deviceId", "soc", "batteryPower"]) {
    const index = headers.indexOf(mapping[field])
    if (index < 0) throw new Error(`Map the required ${field} field.`)
    for (const [rowIndex, row] of rows.entries()) {
      const value = row[index]
      if (
        !value ||
        (field === "timestamp" && !Number.isFinite(Date.parse(value))) ||
        (field === "soc" &&
          (!Number.isFinite(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 100)) ||
        (field === "batteryPower" && !Number.isFinite(Number(value)))
      )
        throw new Error(`Invalid ${field} in row ${rowIndex + 2}.`)
    }
  }
  if (new Set(Object.values(mapping)).size !== 4)
    throw new Error("Map each required field to a different source column.")
}
