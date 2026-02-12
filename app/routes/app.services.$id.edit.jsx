import { useEffect, useState } from "react";
import { Form, useActionData, useNavigation, useLoaderData } from "react-router";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  TextField,
  FormLayout,
  Modal,
  Text,
} from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const serviceId = parseInt(params.id, 10);

  if (isNaN(serviceId)) {
    throw { status: 404, statusText: "Not Found" };
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw { status: 404, statusText: "Service not found" };
  }

  return { service };
};

export const action = async ({ request, params }) => {
  const { redirect } = await authenticate.admin(request);

  const serviceId = parseInt(params.id, 10);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle delete
  if (intent === "delete") {
    try {
      await prisma.service.delete({
        where: { id: serviceId },
      });
      return redirect("/app/services");
    } catch (error) {
      console.error("Failed to delete service:", error);
      return {
        errors: { form: "Failed to delete service. Please try again." },
      };
    }
  }

  // Handle update
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
    await prisma.service.update({
      where: { id: serviceId },
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
      },
    });

    return redirect("/app/services");
  } catch (error) {
    console.error("Failed to update service:", error);
    return {
      errors: { title: "Failed to update service. Please try again." },
      values: { title, description, imageUrl },
    };
  }
};

export default function EditService() {
  const { service } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    title: service.title,
    description: service.description || "",
    imageUrl: service.imageUrl || "",
  });

  const [deleteModalActive, setDeleteModalActive] = useState(false);

  useEffect(() => {
    if (actionData?.values) {
      setFormState(actionData.values);
    }
  }, [actionData]);

  const handleSaveClick = () => {
    const form = document.getElementById("service-form");
    if (form) {
      form.requestSubmit();
    }
  };

  const handleDeleteClick = () => {
    setDeleteModalActive(true);
  };

  const handleDeleteCancel = () => {
    setDeleteModalActive(false);
  };

  const handleDeleteConfirm = () => {
    const form = document.getElementById("delete-form");
    if (form) {
      form.submit();
    }
  };

  return (
    <AppProvider i18n={{}}>
      <Page
        backAction={{ url: "/app/services" }}
        title={`Edit service: ${service.title}`}
        primaryAction={{
          content: "Save",
          onAction: handleSaveClick,
          loading: isSubmitting && !deleteModalActive,
        }}
        secondaryActions={[
          {
            content: "Delete",
            destructive: true,
            onAction: handleDeleteClick,
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <Form method="POST" id="service-form">
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
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>

      <Modal
        open={deleteModalActive}
        onClose={handleDeleteCancel}
        title="Delete service"
        primaryAction={{
          content: "Delete",
          onAction: handleDeleteConfirm,
          destructive: true,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleDeleteCancel,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete &#34;{service.title}&#34;? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Hidden form for delete action */}
      <Form method="POST" id="delete-form" style={{ display: "none" }}>
        <input type="hidden" name="intent" value="delete" />
      </Form>
    </AppProvider>
  );
}
