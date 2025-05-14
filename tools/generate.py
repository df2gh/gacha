

def parse_table(lines, parse_fn):
    entries = []
    for line in lines:
        if not line:
            break
        if line.startswith("#"):
            continue
        parts = line.split("|")
        entries.append(parse_fn(parts))
    return ",\n".join(entries) + ","


def parse_file(path, parse_fn):
    with open(path) as f:
        s = f.read()
    lines = list(s.split("\n"))
    # skip heading "|ID|NAME|"
    if path.endswith("pools.md"):
        # find empty line to split into two tables
        n = lines.index("")
        a = parse_table(lines[1:], parse_fn)
        b = parse_table(lines[n+2:], parse_fn)
        return a, b
    else:
        return parse_table(lines[1:], parse_fn)


def rarity(s):
    return "2" if s == "SSR" else "1" if s == "SR" else "0" if s == "R" else "?"

def parse_items(parts):
    # "", id, name
    return '  {}: ["{}", 0, ITEM]'.format(parts[1], parts[2])

def parse_dolls(parts):
    # "", id, name, rarity
    return '  {}: ["{}", {}, DOLL]'.format(parts[1], parts[2], parts[3])#rarity(parts[3]))

def parse_wepons(parts):
    # "", id, name, rarity
    return '  {}: ["{}", {}, WEPON]'.format(parts[1], parts[2], parts[3])#rarity(parts[3]))

def parse_pools(parts):
    # "", id, name, id
    return '  {}: ["{}", {}]'.format(parts[1], parts[2], parts[3])


def main():
    items = parse_file("../data/items.md", parse_items)
    dolls = parse_file("../data/dolls.md", parse_dolls)
    wepons = parse_file("../data/wepons.md", parse_wepons)
    dolls_pool, wepons_pool = parse_file("../data/pools.md", parse_pools)

    template = """
export const [ITEM, WEPON, DOLL, UNKNOWN] = [0, 1, 2, 3];
export const [R, SR, SSR] = [0, 1, 2];

export const ENTRIES = {{
  // items for misterybox
{ITEMS}

  // dolls
{DOLLS}

  // wepons
{WEPONS}
}};

export const POOLS = {{
  // dolls
{DOLLS_POOL}

  // wepons
{WEPONS_POOL}
}};
"""
    s = template.format(
        ITEMS=items,
        DOLLS=dolls,
        WEPONS=wepons,
        DOLLS_POOL=dolls_pool,
        WEPONS_POOL=wepons_pool,
    )
    path = "../assets/js/data_ja.js"
    with open(path, 'w', encoding='utf-8') as f:
      f.write(s)

main()
