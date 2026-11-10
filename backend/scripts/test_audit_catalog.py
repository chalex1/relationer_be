"""Small independent checks for the graph-isomorphism audit (stdlib unittest)."""
import copy
import unittest
from audit_catalog import audit, isomorphic, paths, reverse


def graph(kind='BIOLOGICAL'):
    return {'id': 'test', 'persons': [{'id': 'a'}, {'id': 'b'}, {'id': 'p'}],
            'personA': 'a', 'personB': 'b',
            'relations': [{'type': kind, 'from': 'p', 'to': 'a'}, {'type': kind, 'from': 'p', 'to': 'b'}]}


class AuditTest(unittest.TestCase):
    def test_renaming_and_reordering_do_not_change_graph(self):
        a = graph()
        b = copy.deepcopy(a)
        names = {'a': 'x', 'b': 'y', 'p': 'z'}
        b['persons'] = [{'id': names[p['id']], 'name': 'arbitrary'} for p in reversed(b['persons'])]
        b['personA'], b['personB'] = 'x', 'y'
        b['relations'] = [{'type': e['type'], 'from': names[e['from']], 'to': names[e['to']]} for e in reversed(b['relations'])]
        self.assertTrue(isomorphic(a, b))

    def test_reversal_is_explicit_and_types_and_direction_are_preserved(self):
        a = graph()
        a['relations'][1] = {'type': 'MARRIAGE', 'from': 'p', 'to': 'b'}
        b = copy.deepcopy(a)
        b['personA'], b['personB'] = b['personB'], b['personA']
        self.assertFalse(isomorphic(a, b))
        self.assertTrue(isomorphic(a, b, swap=True))
        b['relations'][0]['type'] = 'SPIRITUAL'
        self.assertFalse(isomorphic(a, b, swap=True))
        b = copy.deepcopy(a)
        b['relations'][0]['from'], b['relations'][0]['to'] = 'a', 'p'
        self.assertFalse(isomorphic(a, b))

    def test_unused_branch_prevents_full_graph_equivalence(self):
        a = graph()
        b = copy.deepcopy(a)
        b['persons'].append({'id': 'extra'})
        b['relations'].append({'type': 'BIOLOGICAL', 'from': 'a', 'to': 'extra'})
        self.assertFalse(isomorphic(a, b))
        self.assertEqual([t for _, t in paths(a)], [t for _, t in paths(b)])

    def test_marriage_storage_and_adoption_alias_are_normalized(self):
        a, b = graph('ADOPTION'), graph('ADOPTED')
        self.assertTrue(isomorphic(a, b))
        a['relations'][0]['type'] = b['relations'][0]['type'] = 'MARRIAGE'
        b['relations'][0]['from'], b['relations'][0]['to'] = 'a', 'p'
        self.assertTrue(isomorphic(a, b))
        for tokens in [('B>', '<B', 'M', 'G>', '<G', 'U>', '<U'), ('<B', 'B>')]:
            self.assertEqual(tokens, reverse(reverse(tokens)))

    def test_current_known_collisions_and_integrity_are_exposed(self):
        result = audit()
        self.assertEqual(94, result['uniqueCount'])
        self.assertEqual([], result['integrityProblems'])
        self.assertIn(['affinity-forbidden-15', 'affinity-allowed-07'], result['exactGraphGroups'])
        conflict_ids = [set(g['ids']) for g in result['equivalentPathGroups'] if g['conflictingVerdicts']]
        self.assertIn({'affinity-allowed-01', 'affinity-forbidden-24'}, conflict_ids)
        self.assertEqual(11, len(result['exactGraphGroups']))


if __name__ == '__main__':
    unittest.main()
