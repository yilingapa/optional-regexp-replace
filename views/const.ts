export const defaultHighlightColor = {
  rgba: {
    r: 72,
    g: 29,
    b: 10,
    a: 1
  }
}

export const getColorStr = ({ r, g, b, a = 1 }: Record<'r' | 'g' | 'b', number> & {
  a?: number
}) => {
  return `rgba(${r},${g},${b},${a})`
}