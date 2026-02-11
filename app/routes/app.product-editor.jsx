import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "fetch") {
    const rawId = String(formData.get("productId"));
    const id = rawId.startsWith("gid://") ? rawId : `gid://shopify/Product/${rawId}`;

    const response = await admin.graphql(
      `#graphql
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
          }
        }`,
      { variables: { id } }
    );
    return await response.json();
  }

  if (intent === "save") {
    const rawId = String(formData.get("productId"));
    const id = rawId.startsWith("gid://") ? rawId : `gid://shopify/Product/${rawId}`;
    const title = String(formData.get("title"));

    const response = await admin.graphql(
      `#graphql
        mutation updateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id title }
            userErrors { field message }
          }
        }`,
      { variables: { input: { id, title } } }
    );
    const data = await response.json();
    return { ...data, saved: true };
  }

  throw new Response(JSON.stringify({ error: "Invalid intent" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
};

export default function ProductEditor() {
  const fetcher = useFetcher();
  const [productId, setProductId] = useState("");

  const product = fetcher.data?.data?.product;
  const userErrors = fetcher.data?.data?.productUpdate?.userErrors || [];
  const isLoading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.saved && userErrors.length === 0 && typeof window !== "undefined") {
      window.shopify?.toast?.show("Product saved successfully");
    }
  }, [fetcher.data]);

  return (
    <s-page title="Product Editor">
      <s-section>
        <s-stack vertical spacing="loose">
          <fetcher.Form method="post">
            <s-stack vertical spacing="base">
              <label>
                <s-text>Product ID (numeric or full gid)</s-text>
                <input
                  type="text"
                  name="productId"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="12345 or gid://shopify/Product/12345"
                  required
                  style={{ width: "100%", padding: "8px" }}
                />
              </label>
              <input type="hidden" name="intent" value="fetch" />
              <s-button type="submit" disabled={isLoading}>Fetch Product</s-button>
            </s-stack>
          </fetcher.Form>

          {product && (
            <fetcher.Form method="post">
              <s-stack vertical spacing="base">
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="intent" value="save" />
                <label>
                  <s-text>Product Title</s-text>
                  <input
                    type="text"
                    name="title"
                    defaultValue={product.title}
                    required
                    style={{ width: "100%", padding: "8px" }}
                  />
                </label>
                <s-button type="submit" variant="primary" disabled={isLoading}>Save Product</s-button>
                {userErrors.map((err, i) => (
                  <s-box key={i} background="critical">
                    <s-text>{err.message}</s-text>
                  </s-box>
                ))}
              </s-stack>
            </fetcher.Form>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}
