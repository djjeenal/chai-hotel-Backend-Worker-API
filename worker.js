export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Get all payments for admin
    if (path === "/admin/payments") {
      const { results } = await env.DB.prepare(
        "SELECT order_id, amount, method, status FROM payments ORDER BY id DESC"
      ).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default route
    return new Response("Chai Hotel Backend Running 🚀");
  }
}
