#!/usr/bin/env python3
"""Independent, read-only catalog audit. Standard library only; emits JSON to stdout.

Full graph equivalence ignores IDs/names/metadata, retains typed edge direction and
selected A/B, allows A/B reversal, and treats marriage as undirected. Path equivalence
is a separate (weaker) diagnostic, never automatic duplicate removal.
"""
import collections
import argparse
import hashlib
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'src/main/resources/reference-catalog'
INVERSE = {'B>': '<B', '<B': 'B>', 'G>': '<G', '<G': 'G>', 'U>': '<U', '<U': 'U>', 'M': 'M'}
TOKENS = {'BIOLOGICAL': 'B>', 'SPIRITUAL': 'G>', 'ADOPTION': 'U>', 'MARRIAGE': 'M'}


def reverse(tokens):
    return tuple(INVERSE[t] for t in reversed(tokens))


def edges(case):
    result = set()
    for edge in case['relations']:
        kind = 'ADOPTION' if edge['type'] == 'ADOPTED' else edge['type']
        a, b = edge['from'], edge['to']
        if kind == 'MARRIAGE':
            a, b = sorted((a, b))
        result.add((kind, a, b))
    return result


def adjacency(case):
    result = collections.defaultdict(set)
    for kind, a, b in edges(case):
        token = TOKENS[kind]
        result[a].add((b, token))
        result[b].add((a, INVERSE[token]))
    return result


def paths(case, filtered=True):
    adj, biological = adjacency(case), {(a, b) for kind, a, b in edges(case) if kind == 'BIOLOGICAL'}
    result = []

    def visit(nodes, tokens):
        if nodes[-1] == case['personB']:
            if filtered:
                for i in range(len(tokens) - 2):
                    if tokens[i:i + 3] == ('<B', 'M', 'B>') and (nodes[i + 1], nodes[i + 3]) in biological and (nodes[i + 2], nodes[i]) in biological:
                        return
            result.append((tuple(nodes), tuple(tokens)))
            return
        for neighbor, token in sorted(adj[nodes[-1]]):
            if neighbor not in nodes:
                visit(nodes + [neighbor], tokens + (token,))

    visit([case['personA']], ())
    return result


def isomorphic(left, right, swap=False):
    """Exact backtracking with invariant pruning, not a path-hash approximation."""
    if len(left['persons']) != len(right['persons']) or len(edges(left)) != len(edges(right)):
        return False
    la, ra = adjacency(left), adjacency(right)
    li, ri = [p['id'] for p in left['persons']], [p['id'] for p in right['persons']]
    pairs = {left['personA']: right['personB' if swap else 'personA'], left['personB']: right['personA' if swap else 'personB']}

    def signature(adj, node):
        return sorted(collections.Counter(token for _, token in adj[node]).items())

    def labels(adj, a, b):
        return {token for neighbor, token in adj[a] if neighbor == b}

    def compatible(a, b, mapping):
        return signature(la, a) == signature(ra, b) and labels(la, a, a) == labels(ra, b, b) and all(
            labels(la, a, x) == labels(ra, b, y) and labels(la, x, a) == labels(ra, y, b)
            for x, y in mapping.items())

    if any(not compatible(a, b, pairs) for a, b in pairs.items()):
        return False

    def search(mapping):
        if len(mapping) == len(li):
            return True
        candidates = [(a, [b for b in ri if b not in mapping.values() and compatible(a, b, mapping)]) for a in li if a not in mapping]
        a, choices = min(candidates, key=lambda pair: len(pair[1]))
        return any(search({**mapping, a: b}) for b in choices)

    return search(pairs)


def audit():
    production = json.loads((ROOT / 'references.json').read_text())
    drafts = json.loads((ROOT / 'references-draft.json').read_text())
    cases, overlaps, errors = {}, [], []
    for catalog, records in [('production', production), ('draft', drafts)]:
        ids = [c['id'] for c in records]
        if len(set(ids)) != len(ids):
            errors.append({'catalog': catalog, 'problem': 'duplicate ID'})
        for case in records:
            if case['id'] in cases:
                overlaps.append(case['id'])
                if cases[case['id']] != case:
                    errors.append({'id': case['id'], 'problem': 'different overlapping records'})
            else:
                cases[case['id']] = case
    records = list(cases.values())
    details, image_hashes = [], collections.defaultdict(list)
    for case in records:
        ids = {p['id'] for p in case['persons']}
        problems = []
        if len(ids) != len(case['persons']): problems.append('duplicate person ID')
        if case['personA'] not in ids or case['personB'] not in ids or case['personA'] == case['personB']: problems.append('invalid A/B')
        if any(e['from'] not in ids or e['to'] not in ids for e in case['relations']): problems.append('unknown endpoint')
        if any(e['from'] == e['to'] for e in case['relations']): problems.append('self-edge')
        if len(edges(case)) != len(case['relations']): problems.append('duplicate relation (marriage normalized)')
        if not case.get('sources'): problems.append('missing sources')
        images = []
        for source in case.get('sources', []):
            image = ROOT / source.get('image', '')
            if not source.get('title') or source.get('verdict') not in {'ALLOWED', 'FORBIDDEN', 'UNDETERMINED'} or not isinstance(source.get('page'), int) or source['page'] <= 0:
                problems.append('invalid source')
            if not image.is_file() or ROOT.resolve() not in image.resolve().parents:
                problems.append('missing or invalid image')
            else:
                digest = hashlib.sha256(image.read_bytes()).hexdigest()
                image_hashes[digest].append(case['id'])
                images.append({'path': source['image'], 'sha256': digest})
        raw, search = paths(case, False), paths(case)
        if not search: problems.append('no searchable A/B path')
        reached, todo = set(), [case['personA']]
        adj = adjacency(case)
        while todo:
            node = todo.pop()
            if node in reached: continue
            reached.add(node); todo.extend(n for n, _ in adj[node] if n not in reached)
        if reached != ids: problems.append('disconnected graph')
        # Directed ancestry cycles are a data-quality diagnostic, separate from undirected family cycles.
        ancestry = collections.defaultdict(list)
        for kind, a, b in edges(case):
            if kind in {'BIOLOGICAL', 'ADOPTION'}: ancestry[a].append(b)
        def cycle(node, active, done):
            if node in active: return True
            if node in done: return False
            if any(cycle(child, active | {node}, done) for child in ancestry[node]): return True
            done.add(node); return False
        if any(cycle(node, set(), set()) for node in ids): problems.append('ancestry cycle')
        if problems: errors.append({'id': case['id'], 'problems': problems})
        details.append({'id': case['id'], 'page': case['sources'][0]['page'], 'verdict': case['sources'][0]['verdict'],
                        'rawPaths': [{'persons': list(n), 'tokens': list(t), 'code': ''.join(t)} for n, t in raw],
                        'searchPaths': [{'persons': list(n), 'tokens': list(t), 'code': ''.join(t)} for n, t in search], 'images': images})
    parents = {c['id']: c['id'] for c in records}
    def root(key):
        while parents[key] != key: key = parents[key]
        return key
    duplicate_pairs = []
    for a, b in itertools.combinations(records, 2):
        orientation = 'direct' if isomorphic(a, b) else 'reverse' if isomorphic(a, b, True) else None
        if orientation:
            duplicate_pairs.append({'left': a['id'], 'right': b['id'], 'orientation': orientation})
            parents[root(b['id'])] = root(a['id'])
    groups = collections.defaultdict(list)
    for case in records: groups[root(case['id'])].append(case['id'])
    path_groups = collections.defaultdict(list)
    for row in details:
        direct = tuple(sorted(tuple(p['tokens']) for p in row['searchPaths']))
        signature = min(direct, tuple(sorted(reverse(p['tokens']) for p in row['searchPaths'])))
        path_groups[signature].append(row['id'])
    verdict = {row['id']: row['verdict'] for row in details}
    return {'productionCount': len(production), 'draftCount': len(drafts), 'uniqueCount': len(records), 'overlappingIds': overlaps,
            'integrityProblems': errors, 'cases': details, 'exactGraphPairs': duplicate_pairs,
            'exactGraphGroups': [g for g in groups.values() if len(g) > 1],
            'equivalentPathGroups': [{'codes': [''.join(t) for t in signature], 'ids': ids,
                                      'conflictingVerdicts': len({verdict[i] for i in ids}) > 1} for signature, ids in path_groups.items() if len(ids) > 1],
            'identicalImageGroups': [sorted(set(ids)) for ids in image_hashes.values() if len(set(ids)) > 1]}


def verify_kotlin(result, matrix_file):
    """Compare actual Kotlin extractor/search output with the independent token oracle."""
    matrix = json.loads(Path(matrix_file).read_text())
    by_id = {row['id']: row for row in result['cases']}
    assert len(matrix) == len(by_id) and {row['id'] for row in matrix} == set(by_id)
    exact, partial, conflicts = 0, 0, []
    for row in matrix:
        case = by_id[row['id']]
        assert sorted(row['rawPaths']) == sorted(p['code'] for p in case['rawPaths']), row['id']
        assert sorted(row['searchPaths']) == sorted(p['code'] for p in case['searchPaths']), row['id']
        expected = []
        for user in case['searchPaths']:
            for reference in result['cases']:
                for path in reference['searchPaths']:
                    u, r = tuple(user['tokens']), tuple(path['tokens'])
                    container, fragment = (u, r) if reference['verdict'] == 'ALLOWED' else (r, u)
                    if any(container[i:i + len(fragment)] in (fragment, reverse(fragment)) for i in range(len(container) - len(fragment) + 1)):
                        expected.append((reference['id'], reference['verdict'], user['code'], path['code']))
        actual = [(m['referenceId'], m['verdict'], m['userPath'], m['referencePath']) for m in row['matches']]
        assert collections.Counter(expected) == collections.Counter(actual), row['id']
        for hit in row['matches']:
            path = next(p for p in by_id[hit['referenceId']]['searchPaths'] if p['code'] == hit['referencePath'])
            if hit['userPath'] in (path['code'], ''.join(reverse(path['tokens']))): exact += 1
            else: partial += 1
        if {'ALLOWED', 'FORBIDDEN'} <= {m['verdict'] for m in row['matches']}: conflicts.append(row['id'])
    return {'verifiedPairs': len(matrix) * len(by_id), 'matches': exact + partial,
            'exactPathMatches': exact, 'partialMatches': partial, 'conflictingInputIds': conflicts}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kotlin-matrix', help='Path to search-matrix.json emitted by CatalogSearchAuditTest')
    args = parser.parse_args()
    result = audit()
    if args.kotlin_matrix: result['kotlinVerification'] = verify_kotlin(result, args.kotlin_matrix)
    print(json.dumps(result, ensure_ascii=False, indent=2))
