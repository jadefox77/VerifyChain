// Redirect after a form POST. A 303 makes the browser follow with a GET, and
// a relative Location stays correct behind proxies, where req.url can carry
// an internal host. Only pass paths that start with "/".
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } })
}
