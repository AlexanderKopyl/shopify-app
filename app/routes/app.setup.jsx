import { useState, useEffect } from "react";
import { useFetcher, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const logs = [];

  try {
    // Step 1: Check if metaobject definition exists
    logs.push({ type: "info", message: "Checking for existing metaobject definition..." });

    const checkDefinitionResponse = await admin.graphql(
      `#graphql
        query {
          metaobjectDefinitions(first: 50) {
            edges {
              node {
                id
                type
                name
              }
            }
          }
        }`
    );

    const definitionsData = await checkDefinitionResponse.json();
    const existingDefinition = definitionsData.data.metaobjectDefinitions.edges.find(
      (edge) => edge.node.type === "zoo_service"
    );

    let definitionId = existingDefinition?.node?.id;

    // Step 2: Create metaobject definition if it doesn't exist
    if (!existingDefinition) {
      logs.push({ type: "info", message: "Creating zoo_service metaobject definition..." });

      const createDefinitionResponse = await admin.graphql(
        `#graphql
          mutation createMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
            metaobjectDefinitionCreate(definition: $definition) {
              metaobjectDefinition {
                id
                type
                name
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            definition: {
              type: "zoo_service",
              name: "Zoo Service",
              description: "Service catalog for Zoo products",
              fieldDefinitions: [
                {
                  key: "title",
                  name: "Title",
                  type: "single_line_text_field",
                  required: true,
                },
                {
                  key: "description",
                  name: "Description",
                  type: "multi_line_text_field",
                },
                {
                  key: "image_url",
                  name: "Image URL",
                  type: "url",
                },
              ],
              access: {
                storefront: "PUBLIC_READ",
              },
            },
          },
        }
      );

      const createDefinitionData = await createDefinitionResponse.json();

      if (createDefinitionData.data.metaobjectDefinitionCreate.userErrors.length > 0) {
        const errors = createDefinitionData.data.metaobjectDefinitionCreate.userErrors;
        logs.push({
          type: "error",
          message: `Failed to create definition: ${errors.map(e => e.message).join(", ")}`
        });
        return { success: false, logs };
      }

      definitionId = createDefinitionData.data.metaobjectDefinitionCreate.metaobjectDefinition.id;
      logs.push({
        type: "success",
        message: `Created metaobject definition: ${definitionId}`
      });
    } else {
      logs.push({
        type: "success",
        message: `Found existing metaobject definition: ${definitionId}`
      });
    }

    // Step 3: Fetch all services from Prisma
    logs.push({ type: "info", message: "Fetching services from database..." });
    const services = await prisma.service.findMany();
    logs.push({ type: "info", message: `Found ${services.length} services to sync` });

    // Step 4: Sync each service to Shopify
    let successCount = 0;
    let errorCount = 0;

    for (const service of services) {
      try {
        logs.push({
          type: "info",
          message: `Syncing service: ${service.title}`
        });

        // Prepare metaobject fields
        const fields = [
          {
            key: "title",
            value: service.title,
          },
        ];

        if (service.description) {
          fields.push({
            key: "description",
            value: service.description,
          });
        }

        if (service.imageUrl) {
          fields.push({
            key: "image_url",
            value: service.imageUrl,
          });
        }

        // Use metaobjectUpsert with handle based on service ID
        const handle = `service-${service.id}`;

        const upsertResponse = await admin.graphql(
          `#graphql
            mutation upsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
              metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
                metaobject {
                  id
                  handle
                  displayName
                  fields {
                    key
                    value
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              handle: {
                type: "zoo_service",
                handle: handle,
              },
              metaobject: {
                fields: fields,
              },
            },
          }
        );

        const upsertData = await upsertResponse.json();

        if (upsertData.data.metaobjectUpsert.userErrors.length > 0) {
          const errors = upsertData.data.metaobjectUpsert.userErrors;
          logs.push({
            type: "error",
            message: `Failed to sync "${service.title}": ${errors.map(e => e.message).join(", ")}`
          });
          errorCount++;
          continue;
        }

        const metaobjectId = upsertData.data.metaobjectUpsert.metaobject.id;

        // Update Prisma record with metaobjectId
        await prisma.service.update({
          where: { id: service.id },
          data: { metaobjectId },
        });

        logs.push({
          type: "success",
          message: `✓ Synced "${service.title}" (${metaobjectId})`
        });
        successCount++;
      } catch (error) {
        logs.push({
          type: "error",
          message: `Error syncing "${service.title}": ${error.message}`
        });
        errorCount++;
      }
    }

    logs.push({
      type: "info",
      message: `\n=== Sync Complete ===\nSuccess: ${successCount}\nErrors: ${errorCount}\nTotal: ${services.length}`
    });

    return {
      success: true,
      logs,
      stats: {
        total: services.length,
        success: successCount,
        errors: errorCount,
      },
    };
  } catch (error) {
    logs.push({
      type: "error",
      message: `Fatal error: ${error.message}`
    });
    return { success: false, logs };
  }
};

export default function Setup() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [logs, setLogs] = useState([]);

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.logs) {
      setLogs(fetcher.data.logs);
    }

    if (fetcher.data?.success && fetcher.data?.stats) {
      const { success, errors } = fetcher.data.stats;
      if (errors === 0) {
        shopify.toast.show(`Successfully synced ${success} services`);
      } else {
        shopify.toast.show(`Synced ${success} services with ${errors} errors`, {
          isError: true,
        });
      }
    }
  }, [fetcher.data, shopify]);

  const handleInitialize = () => {
    setLogs([]);
    fetcher.submit({}, { method: "POST" });
  };

  const getLogStyle = (type) => {
    const baseStyle = {
      padding: "8px 12px",
      borderRadius: "4px",
      marginBottom: "4px",
      fontFamily: "monospace",
      fontSize: "13px",
      whiteSpace: "pre-wrap",
    };

    switch (type) {
      case "success":
        return { ...baseStyle, backgroundColor: "#d4edda", color: "#155724" };
      case "error":
        return { ...baseStyle, backgroundColor: "#f8d7da", color: "#721c24" };
      case "info":
      default:
        return { ...baseStyle, backgroundColor: "#d1ecf1", color: "#0c5460" };
    }
  };

  return (
    <s-page heading="Metaobject Setup & Sync">
      <s-button
        slot="primary-action"
        onClick={handleInitialize}
        {...(isLoading ? { loading: true } : {})}
      >
        {isLoading ? "Initializing..." : "Initialize & Sync"}
      </s-button>

      <s-section heading="Setup Instructions">
        <s-paragraph>
          This page will initialize the Shopify metaobject definition for zoo_service
          and sync all existing services from your database to Shopify.
        </s-paragraph>
        <s-paragraph>
          Click the &quot;Initialize &amp; Sync&quot; button to:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Check or create the zoo_service metaobject definition</s-list-item>
          <s-list-item>Sync all services to Shopify as metaobjects</s-list-item>
          <s-list-item>Update database records with Shopify metaobject IDs</s-list-item>
        </s-unordered-list>
      </s-section>

      {logs.length > 0 && (
        <s-section heading="Sync Log">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {logs.map((log, index) => (
                <div key={index} style={getLogStyle(log.type)}>
                  {log.message}
                </div>
              ))}
            </div>
          </s-box>
        </s-section>
      )}

      {fetcher.data?.stats && (
        <s-section heading="Sync Results">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              <s-text variant="strong">Total Services: </s-text>
              <s-text>{fetcher.data.stats.total}</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text variant="strong">Successfully Synced: </s-text>
              <s-text>{fetcher.data.stats.success}</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text variant="strong">Errors: </s-text>
              <s-text>{fetcher.data.stats.errors}</s-text>
            </s-paragraph>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
