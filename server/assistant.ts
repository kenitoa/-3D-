import { fetchProvider } from './providers';
import type { CampusProvider, ProviderTransport } from './providers';
import type { CampusCatalog, PlatformEntity } from '../src/types/platform-types';

export interface ApprovedQuestion { catalog: CampusCatalog; question: string; campusId: string; contentVersion: string; purpose?: string }
export interface AuthoredAnswerEntity { id: string; name: string; kind: string; purpose: string; category: string; floorLabel: string | null; confirmation: string; nameConfirmation: string; sourceIds: string[] }
export interface ApprovedAnswer { contentVersion: string; entities: AuthoredAnswerEntity[]; sourceIds: string[]; mode: 'provider' | 'catalog' }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s\p{P}\p{S}]+/gu, '');
const stopwords = new Set(['where', 'is', 'are', 'the', 'a', 'an', 'please', 'find', 'show', 'what', 'which', 'can', 'you', 'me', 'to', 'how', 'go', 'get', 'location', 'that', '어디', '어디야', '어딨어', '어디에', '어디있어', '어디있나요', '찾아', '찾기', '찾아줘', '알려', '알려줘', '알려주세요', '보여', '보여줘', '안내']);

/** A provider may rank approved entity IDs; every returned word still comes from the current public catalog. */
export async function answerApprovedQuestion(request: ApprovedQuestion, providers: CampusProvider[], transport: ProviderTransport = fetchProvider): Promise<ApprovedAnswer> {
  if (!record(request) || !record(request.catalog) || typeof request.question !== 'string' || !request.question.trim() || request.question.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(request.question) || typeof request.campusId !== 'string' || typeof request.contentVersion !== 'string' || request.catalog.contentVersion !== request.contentVersion || !Array.isArray(request.catalog.campuses) || !request.catalog.campuses.some((campus) => campus.id === request.campusId) || !Array.isArray(request.catalog.entities) || !Array.isArray(request.catalog.sources) || request.purpose !== undefined && (typeof request.purpose !== 'string' || request.purpose.length > 120)) throw new Error('ASSISTANT_REQUEST_REJECTED');
  const catalog = request.catalog;
  const sources = new Map(catalog.sources.filter((source) => source.visibility === 'public').map((source) => [source.id, source]));
  const entities = new Map(catalog.entities.map((entity) => [entity.id, entity]));
  const isPublic = (entity: PlatformEntity): boolean => {
    if (entity.campusId !== request.campusId || entity.visibility !== 'public' || entity.sensitive || entity.status !== 'current') return false;
    const seen = new Set<string>(); let parent = entity.parentId;
    while (parent) { if (seen.has(parent)) return false; seen.add(parent); const owner = entities.get(parent); if (!owner || owner.visibility !== 'public' || owner.sensitive || owner.campusId !== request.campusId || owner.status !== 'current') return false; parent = owner.parentId; }
    return true;
  };
  const terms = request.question.split(/[\s\p{P}\p{S}]+/u).map(normalize).map((term) => term.replace(/(?:은|는|이|가|을|를|에|에서|으로|의)?(?:어디(?:에|야|인가요|있어|있나요)?|알려(?:줘|주세요)?|찾아(?:줘|주세요)?|보여(?:줘|주세요)?)$/u, '')).filter((term) => term.length >= 2 && !stopwords.has(term));
  const publicEntities = catalog.entities.filter(isPublic), question = terms.length ? terms.join('') : stopwords.has(normalize(request.question)) ? '' : normalize(request.question), purpose = normalize(request.purpose || '');
  const score = (entity: PlatformEntity) => {
    const names = [entity.name, entity.displayTitle, ...entity.aliases].map(normalize), description = normalize(`${entity.purpose} ${entity.category} ${entity.floorLabel || ''}`);
    let value = question && names.some((name) => name === question || name.length >= 2 && question.length >= 2 && (question.includes(name) || name.includes(question))) ? 100 : 0;
    for (const term of terms) { if (names.some((name) => name.includes(term) || term.includes(name) && name.length >= 2)) value += 10; else if (description.includes(term)) value += 3; }
    if (purpose && description.includes(purpose)) value += 2;
    return value;
  };
  const candidates = publicEntities.map((entity) => ({ entity, score: score(entity) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.entity.id.localeCompare(b.entity.id)).slice(0, 20).map((item) => item.entity);
  const sourceIdsFor = (entity: PlatformEntity) => [...new Set(Object.values(entity.claims).flatMap((claim) => claim.sourceIds).filter((id) => sources.has(id)))].sort();
  const authored = (entity: PlatformEntity): AuthoredAnswerEntity => ({ id: entity.id, name: entity.name, kind: entity.kind, purpose: entity.purpose, category: entity.category, floorLabel: entity.floorLabel, confirmation: entity.confidence, nameConfirmation: entity.claims.name.confidence, sourceIds: sourceIdsFor(entity) });
  const answer = (selected: PlatformEntity[], mode: ApprovedAnswer['mode']): ApprovedAnswer => { const result = selected.map(authored); return { contentVersion: catalog.contentVersion, entities: result, sourceIds: [...new Set(result.flatMap((entity) => entity.sourceIds))].sort(), mode }; };
  const fallback = () => answer(candidates, 'catalog');
  const verifiedSources = new Set([...sources].filter(([, source]) => source.confidence === 'verified').map(([id]) => id));
  const eligible = providers.find((provider) => provider.enabled && provider.kind === 'assistant' && provider.campusId === request.campusId && verifiedSources.has(provider.sourceId));
  const verifiedCandidates = candidates.filter((entity) => entity.claims.name.confidence === 'verified' && entity.claims.name.sourceIds.some((id) => verifiedSources.has(id)));
  if (!eligible || !verifiedCandidates.length) return fallback();
  const allowedIds = new Map(verifiedCandidates.map((entity) => [entity.id, entity]));
  const allowedSources = new Set(verifiedCandidates.flatMap((entity) => entity.claims.name.sourceIds).filter((id) => verifiedSources.has(id)));
  const payload = { campusId: request.campusId, contentVersion: request.contentVersion, question: request.question, purpose: request.purpose || '', candidates: verifiedCandidates.map((entity) => ({ id: entity.id, name: entity.name, kind: entity.kind, purpose: entity.purpose, category: entity.category, sourceIds: entity.claims.name.sourceIds.filter((id) => allowedSources.has(id)) })), sources: [...allowedSources].sort().map((id) => ({ id, title: sources.get(id)?.title || '' })) };
  if (Buffer.byteLength(JSON.stringify(payload)) > 32768) return fallback();
  try {
    const response = await transport(eligible, payload);
    if (!record(response) || response.contentVersion !== request.contentVersion || !Array.isArray(response.entityIds) || response.entityIds.length > 20 || !response.entityIds.every((id) => typeof id === 'string' && allowedIds.has(id)) || new Set(response.entityIds).size !== response.entityIds.length || !Array.isArray(response.sourceIds) || response.sourceIds.length > 100 || !response.sourceIds.every((id) => typeof id === 'string' && allowedSources.has(id)) || new Set(response.sourceIds).size !== response.sourceIds.length) return fallback();
    const selected = response.entityIds.flatMap((id) => { const entity = allowedIds.get(id); return entity ? [entity] : []; });
    const returnedSourceIds = response.sourceIds;
    const selectedSourceIds = new Set(selected.flatMap((entity) => entity.claims.name.sourceIds).filter((id) => allowedSources.has(id)));
    if (!selected.length || !returnedSourceIds.length || returnedSourceIds.some((id) => !selectedSourceIds.has(id)) || selected.some((entity) => !entity.claims.name.sourceIds.some((id) => returnedSourceIds.includes(id)))) return fallback();
    return answer(selected, 'provider');
  } catch { return fallback(); }
}
