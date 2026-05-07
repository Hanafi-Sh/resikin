export async function fetchWithAuthRetry(input, init = {}) {
  const requestInit = {
    ...init,
    credentials: init.credentials || 'same-origin',
  };

  let response;

  try {
    response = await fetch(input, requestInit);
  } catch (firstError) {
    return fetch(input, requestInit);
  }

  if (response.status !== 401) {
    return response;
  }

  try {
    return await fetch(input, requestInit);
  } catch {
    return response;
  }
}
