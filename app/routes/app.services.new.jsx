import { useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  TextField,
  FormLayout,
  Button,
} from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin, redirect } = await authenticate.admin(request);

  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();

  const errors = {};
  if (!title) {
    errors.title = "Title is required";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: { title, description, imageUrl },
    };
  }

  try {
    // Create service in Prisma first
    const service = await prisma.service.create({
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
      },
    });

    // Sync to Shopify Metaobject
    const metaobjectFields = [
      { key: "title", value: title },
    ];

    if (description) {
      metaobjectFields.push({ key: "description", value: description });
    }

    if (imageUrl) {
      metaobjectFields.push({ key: "image", value: imageUrl });
    }

    const metaobjectResponse = await admin.graphql(
      `#graphql
        mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
          metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
            metaobject {
              id
              handle
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
          },
          metaobject: {
            fields: metaobjectFields,
          },
        },
      }
    );

    const metaobjectData = await metaobjectResponse.json();
    const metaobjectResult = metaobjectData.data?.metaobjectUpsert;

    if (metaobjectResult?.userErrors?.length > 0) {
      console.error("Metaobject creation errors:", metaobjectResult.userErrors);
      // Continue even if metaobject creation fails - service is already in Prisma
    } else if (metaobjectResult?.metaobject?.id) {
      // Update Prisma with Shopify Metaobject ID
      await prisma.service.update({
        where: { id: service.id },
        data: { metaobjectId: metaobjectResult.metaobject.id },
      });
    }

    return redirect("/app");
  } catch (error) {
    console.error("Failed to create service:", error);
    return {
      errors: { title: "Failed to create service. Please try again." },
      values: { title, description, imageUrl },
    };
  }
};

export default function NewService() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });

  useEffect(() => {
    if (actionData?.values) {
      setFormState(actionData.values);
    }
  }, [actionData]);

  return (
    <AppProvider i18n={{}}>
      <Page backAction={{ url: "/app" }} title="Create new service">
        <Layout>
          <Layout.Section>
            <Card>
              <Form method="POST">
                <FormLayout>
                  <TextField
                    label="Title"
                    name="title"
                    value={formState.title}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, title: value }))
                    }
                    error={actionData?.errors?.title}
                    requiredIndicator
                    autoComplete="off"
                  />
                  <TextField
                    label="Description"
                    name="description"
                    value={formState.description}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, description: value }))
                    }
                    multiline={4}
                    autoComplete="off"
                  />
                  <TextField
                    label="Image URL"
                    name="imageUrl"
                    type="url"
                    value={formState.imageUrl}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, imageUrl: value }))
                    }
                    helpText="Optional: Paste a link to an image"
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSubmitting}>
                    Create service
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}
