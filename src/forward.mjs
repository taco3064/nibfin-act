const statuses = new Map([['completed', 0], ['denied', 1], ['pending', 2]]);
const diagnostic = value =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value);

function failure(status, code) {
  return { status, code, exitCode: statuses.get(status) };
}

// The host supplies this dependency as code, never from Action/Event JSON.
// Its names are the existing Core v1 transport and executor, not a new protocol.
// This internal seam is fixture-tested; no producer release is bound yet.
export async function forwardStage(request, core) {
  if (!core) return failure('denied', 'CORE_RELEASE_UNAVAILABLE');
  if (typeof request !== 'string') return failure('denied', 'INVALID_ACTION_INPUT');
  if (typeof core.runStageInput !== 'function' ||
    typeof core.executor?.run !== 'function') {
    return failure('denied', 'CORE_INTERFACE_UNAVAILABLE');
  }
  let result;
  try {
    // Core alone parses stage fields and authorizes the actual native context.
    // Never retry after an exception: the external effect may be unknown.
    result = await core.runStageInput(request, core.executor);
  } catch {
    return failure('pending', 'CORE_RESULT_UNKNOWN');
  }
  if (result?.schemaVersion !== 1 || !statuses.has(result.status)) {
    return failure('pending', 'INVALID_CORE_RESULT');
  }
  if (result.code !== undefined && !diagnostic(result.code)) {
    return failure('pending', 'INVALID_CORE_RESULT');
  }
  return { status: result.status, code: result.code ?? '',
    exitCode: statuses.get(result.status) };
}
