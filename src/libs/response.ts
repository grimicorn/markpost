// @todo Test apiResponse
export const apiResponse = (
  body: object,
  status: number, // @todo Type this to a valid HTTP response???
  headers: object = {}, // @todo Type this to a valid HTTP response headers object???
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/vnd.api+json" },
  });
};
