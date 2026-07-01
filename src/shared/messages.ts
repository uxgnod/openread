import type {
  PageTranslationState,
  OpenSelectionTranslationRequest,
  OpenSelectionTranslationResponse,
  SetPageProviderRequest,
  StartTranslationRequest,
  TestProviderResponse,
  TranslateFragmentRequest,
  TranslateFragmentResponse,
  UserConfig,
} from "./types"
import type {
  CurrentPageContext,
  InspectElementRequest,
  InspectElementResponse,
  PageStructureSnapshot,
  PageSiteRuleStatus,
  SiteRuleExport,
  SiteRuleIdRequest,
  SiteRuleIdResponse,
  SiteRuleImport,
  SiteRuleMatchExplanation,
  SiteRulePack,
  SiteRulePreviewRequest,
  SiteRulePreviewResponse,
  SnapshotPageStructureRequest,
  StartRuleSelectionRequest,
  StartRuleSelectionResponse,
} from "./site-rules"

export interface RequestMap {
  DELETE_SITE_RULE: SiteRuleIdRequest
  EXPORT_SITE_RULE: SiteRuleIdRequest
  EXPLAIN_SITE_RULE_MATCH: SiteRulePreviewRequest
  GET_CONFIG: undefined
  GET_CURRENT_PAGE_CONTEXT: undefined
  SAVE_CONFIG: UserConfig
  GET_SITE_RULES: undefined
  IMPORT_SITE_RULE: SiteRuleImport
  INSPECT_ELEMENT: InspectElementRequest
  PREVIEW_SITE_RULE: SiteRulePreviewRequest
  TEST_PROVIDER: UserConfig
  TRANSLATE_FRAGMENT: TranslateFragmentRequest
  SET_PAGE_PROVIDER: SetPageProviderRequest
  SAVE_SITE_RULE: SiteRulePack
  SNAPSHOT_PAGE_STRUCTURE: SnapshotPageStructureRequest | undefined
  START_RULE_SELECTION: StartRuleSelectionRequest
  START_TRANSLATION: StartTranslationRequest
  START_TRANSLATION_WITH_INLINE_RULE: StartTranslationRequest & { inlineSiteRule: SiteRulePack }
  START_TRANSLATION_WITH_RULE: StartTranslationRequest & { siteRuleId: string }
  OPEN_SELECTION_TRANSLATION: OpenSelectionTranslationRequest
  STOP_RULE_SELECTION: undefined
  STOP_TRANSLATION: undefined
  GET_PAGE_TRANSLATION_STATE: undefined
  GET_PAGE_SITE_RULE_STATUS: undefined
}

export interface ResponseMap {
  DELETE_SITE_RULE: SiteRuleIdResponse
  EXPORT_SITE_RULE: SiteRuleExport
  EXPLAIN_SITE_RULE_MATCH: SiteRuleMatchExplanation
  GET_CONFIG: UserConfig
  GET_CURRENT_PAGE_CONTEXT: CurrentPageContext
  SAVE_CONFIG: UserConfig
  GET_SITE_RULES: SiteRulePack[]
  IMPORT_SITE_RULE: SiteRulePack
  INSPECT_ELEMENT: InspectElementResponse
  PREVIEW_SITE_RULE: SiteRulePreviewResponse
  TEST_PROVIDER: TestProviderResponse
  TRANSLATE_FRAGMENT: TranslateFragmentResponse
  SET_PAGE_PROVIDER: PageTranslationState
  SAVE_SITE_RULE: SiteRulePack
  SNAPSHOT_PAGE_STRUCTURE: PageStructureSnapshot
  START_RULE_SELECTION: StartRuleSelectionResponse
  START_TRANSLATION: PageTranslationState
  START_TRANSLATION_WITH_INLINE_RULE: PageTranslationState
  START_TRANSLATION_WITH_RULE: PageTranslationState
  OPEN_SELECTION_TRANSLATION: OpenSelectionTranslationResponse
  STOP_RULE_SELECTION: StartRuleSelectionResponse
  STOP_TRANSLATION: PageTranslationState
  GET_PAGE_TRANSLATION_STATE: PageTranslationState
  GET_PAGE_SITE_RULE_STATUS: PageSiteRuleStatus
}

export type MessageType = keyof RequestMap

export type OpenReadMessage<TType extends MessageType = MessageType> = {
  [K in MessageType]: RequestMap[K] extends undefined
    ? { type: K }
    : { type: K; payload: RequestMap[K] }
}[TType]

export type OpenReadResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export function createMessage<TType extends MessageType>(
  type: TType,
  payload?: RequestMap[TType],
): OpenReadMessage<TType> {
  if (payload === undefined) {
    return { type } as OpenReadMessage<TType>
  }
  return { type, payload } as OpenReadMessage<TType>
}

export async function sendRuntimeMessage<TType extends MessageType>(
  type: TType,
  payload?: RequestMap[TType],
): Promise<ResponseMap[TType]> {
  const response = (await chrome.runtime.sendMessage(
    createMessage(type, payload),
  )) as OpenReadResponse<ResponseMap[TType]>
  return unwrapResponse(response)
}

export async function sendTabMessage<TType extends MessageType>(
  tabId: number,
  type: TType,
  payload?: RequestMap[TType],
): Promise<ResponseMap[TType]> {
  const response = (await chrome.tabs.sendMessage(
    tabId,
    createMessage(type, payload),
  )) as OpenReadResponse<ResponseMap[TType]>
  return unwrapResponse(response)
}

export function unwrapResponse<T>(response: OpenReadResponse<T> | undefined): T {
  if (!response) {
    throw new Error("No response received from OpenRead extension runtime.")
  }
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.data
}

export function isOpenReadMessage(value: unknown): value is OpenReadMessage {
  return (
    typeof value === "object"
    && value !== null
    && "type" in value
    && typeof (value as { type: unknown }).type === "string"
  )
}

export function messageError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unknown OpenRead error."
}
