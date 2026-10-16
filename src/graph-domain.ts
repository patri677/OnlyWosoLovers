/** Pure graph rules shared by the offline page, build and regression checks. */
namespace WosoGraph {
  export interface Person {
    id: string;
    name: string;
    meta: string;
    intro: string;
    avatar: string;
    x: number;
    y: number;
    country?: string;
    club?: string;
  }
  export interface Relationship {
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
  }
  export interface Graph { nodes: Person[]; edges: Relationship[] }
  export interface Filters { relations: string[]; clubs: string[]; countries: string[] }
  /** A camera change must never choose a different position along an edge. */
  export function relationshipLabelPosition(x1: number, y1: number, x2: number, y2: number, contentScale = 1): { x: number; y: number } {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 7 * contentScale };
  }
  export type RelationKind = 'ex' | 'cur' | 'married' | 'engaged' | 'exQuestion' | 'curQuestion' | 'nt' | 'club' | 'formerClub' | 'friend' | 'family' | 'other';
  type RecordValue = Record<string, unknown>;
  const knownKinds = new Set<string>(['ex','cur','married','engaged','exQuestion','curQuestion','nt','club','formerClub','friend','family','other']);
  function isRecord(value: unknown): value is RecordValue {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function stringChoices(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))] : [];
  }
  export function normalizeFilters(value: unknown): Filters | null {
    const raw: RecordValue = Array.isArray(value) ? { relations: value } : isRecord(value) ? value : {};
    const result = { relations: stringChoices(raw.relations), clubs: stringChoices(raw.clubs), countries: stringChoices(raw.countries) };
    return result.relations.length || result.clubs.length || result.countries.length ? result : null;
  }
  export function personFacets(person: Pick<Person, 'meta' | 'country' | 'club'>): { country: string; club: string } {
    const parts = (person.meta || '').split('/').map(part => part.trim()).filter(Boolean);
    const stripCaptain = (value: string): string => value.replace(/\s*[（(]C[）)]/gi, '').trim();
    return {
      country: stripCaptain(person.country || parts[0] || ''),
      club: stripCaptain(person.club || (parts.length > 1 ? parts.slice(1).join(' / ') : '')),
    };
  }
  export function relationKeys(edge: Relationship): RelationKind[] {
    const label = (edge.label || '').normalize('NFKC').replace(/\s/g, '');
    const keys: RelationKind[] = [];
    if (/现任\(已婚\)/.test(label)) keys.push('married');
    if (/现任\(订婚\)/.test(label)) keys.push('engaged');
    if (/前任\?/.test(label)) keys.push('exQuestion');
    if (/现任\?/.test(label)) keys.push('curQuestion');
    if (/现任/.test(label) && !keys.includes('curQuestion')) keys.push('cur');
    if (/前任/.test(label) && !keys.includes('exQuestion')) keys.push('ex');
    if (/国家队队友/.test(label)) keys.push('nt');
    if (/前俱乐部队友/.test(label)) keys.push('formerClub');
    else if (/俱乐部队友/.test(label)) keys.push('club');
    if (/好友|bestfriends?|bestie/i.test(label)) keys.push('friend');
    if (/家人|母女|一家三口|姐妹|姐弟|兄弟/.test(label)) keys.push('family');
    if (!keys.length) {
      const type = knownKinds.has(edge.type) ? edge.type as RelationKind : 'other';
      keys.push(type);
      if (type === 'married' || type === 'engaged') keys.push('cur');
    }
    return [...new Set(keys)];
  }
  export function personMatches(person: Person, filters: Filters | null): boolean {
    if (!filters) return true;
    const facets = personFacets(person);
    return (!filters.countries.length || filters.countries.includes(facets.country)) &&
      (!filters.clubs.length || filters.clubs.includes(facets.club));
  }
  export function relationMatches(edge: Relationship, filters: Filters | null): boolean {
    if (!filters?.relations.length) return true;
    return relationKeys(edge).some(key => filters.relations.includes(key) ||
      (filters.relations.includes('cur') && ['married','engaged','curQuestion'].includes(key)) ||
      (filters.relations.includes('ex') && key === 'exQuestion'));
  }
  export function edgeMatches(edge: Relationship, nodes: readonly Person[], filters: Filters | null): boolean {
    if (!relationMatches(edge, filters)) return false;
    if (!filters || (!filters.countries.length && !filters.clubs.length)) return true;
    return nodes.some(person => (person.id === edge.source || person.id === edge.target) && personMatches(person, filters));
  }
  export function validateGraph(input: unknown, labels: Readonly<Record<string, string>> = {}): Graph {
    if (!isRecord(input)) throw Error('缺少人物或关系数据');
    if (input.format != null && input.format !== 'person-relationship-map') throw Error('不是人物关系图谱的数据文件');
    if (input.format != null && input.version !== 1) throw Error('该备份版本暂不支持导入');
    const raw = input.format === 'person-relationship-map' ? input.data : input;
    if (!isRecord(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw Error('缺少人物或关系数据');
    if (raw.nodes.length > 10000 || raw.edges.length > 50000) throw Error('数据量超出当前页面的安全限制');
    const ids = new Set<string>();
    const nodes: Person[] = raw.nodes.map((value: unknown, i: number): Person => {
      if (!isRecord(value) || typeof value.id !== 'string' || !value.id || ids.has(value.id)) throw Error(`第 ${i + 1} 个人物的 ID 无效或重复`);
      if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.y !== 'number' || !Number.isFinite(value.y)) throw Error(`第 ${i + 1} 个人物的位置无效`);
      for (const field of ['name','meta','intro','avatar','country','club']) {
        if (value[field] != null && typeof value[field] !== 'string') throw Error(`第 ${i + 1} 个人物的 ${field} 字段无效`);
      }
      const avatar = typeof value.avatar === 'string' ? value.avatar : '';
      if (/[\u0000-\u0020\u007f"'<>`]/.test(avatar)) throw Error(`第 ${i + 1} 个人物的头像地址包含不安全字符`);
      if (avatar && !/^https?:\/\//i.test(avatar) && !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(avatar)) throw Error(`第 ${i + 1} 个人物的头像格式不支持`);
      ids.add(value.id);
      const person: Person = {
        id: value.id, name: typeof value.name === 'string' ? value.name : '',
        meta: typeof value.meta === 'string' ? value.meta : '',
        intro: typeof value.intro === 'string' ? value.intro : '', avatar, x: value.x, y: value.y,
      };
      if (typeof value.country === 'string') person.country = value.country;
      if (typeof value.club === 'string') person.club = value.club;
      return person;
    });
    const edgeIds = new Set<string>();
    const edges: Relationship[] = raw.edges.map((value: unknown, i: number): Relationship => {
      if (!isRecord(value) || typeof value.id !== 'string' || !value.id || edgeIds.has(value.id)) throw Error(`第 ${i + 1} 条关系的 ID 无效或重复`);
      if (typeof value.source !== 'string' || typeof value.target !== 'string' || !ids.has(value.source) || !ids.has(value.target)) throw Error(`第 ${i + 1} 条关系引用了不存在的人物`);
      if (typeof value.type !== 'string' || !value.type || (value.label != null && typeof value.label !== 'string')) throw Error(`第 ${i + 1} 条关系的类型或名称无效`);
      edgeIds.add(value.id);
      return { id: value.id, source: value.source, target: value.target, type: value.type, label: typeof value.label === 'string' && value.label ? value.label : labels[value.type] || '关系' };
    });
    return { nodes, edges };
  }
}
