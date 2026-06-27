import type {
  PageTranslationState,
  SetPageProviderRequest,
  StartTranslationRequest,
  TestProviderResponse,
  TranslateFragmentRequest,
  TranslateFragmentResponse,
  UserConfig,
} from "./types"

export interface RequestMap {
  GET_CONFIG: undefined
  SAVE_CONFIG: UserConfig
  TEST_PROVIDER: UserConfig
  TRANSLATE_FRAGMENT: TranslateFragmentRequest
  SET_PAGE_PROVIDER: SetPageProviderRequest
  START_TRANSLATION: StartTranslationRequest
  STOP_TRANSLATION: undefined
  GET_PAGE_TRANSLATION_STATE: undefined
}

export interface ResponseMap {
  GET_CONFIG: UserConfig
  SAVE_CONFIG: UserConfig
  TEST_PROVIDER: TestProviderResponse
  TRANSLATE_FRAGMENT: TranslateFragmentResponse
  SET_PAGE_PROVIDER: PageTranslationState
  START_TRANSLATION: PageTranslationState
  STOP_TRANSLATION: PageTranslationState
  GET_PAGE_TRANSLATION_STATE: PageTranslationState
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
