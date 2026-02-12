import { useState } from "react";
import { useLoaderData, useFetcher, Link, useNavigate } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  EmptyState,
  Button,
  InlineStack,
  Modal,
  Text, AppProvider,
} from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const services = await prisma.service.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { services };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const serviceId = formData.get("serviceId");

  if (request.method === "DELETE" && serviceId) {
    try {
      await prisma.service.delete({
        where: { id: parseInt(serviceId, 10) },
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to delete service:", error);
      return { error: "Failed to delete service" };
    }
  }

  return { error: "Invalid request" };
};

export default function ServicesList() {
  const { services } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  const handleDeleteClick = (service) => {
    setServiceToDelete(service);
    setDeleteModalActive(true);
  };

  const handleNewService = () => {
    navigate("/app/services/new");
  };

  const handleDeleteConfirm = () => {
    if (serviceToDelete) {
      fetcher.submit(
        { serviceId: serviceToDelete.id },
        { method: "DELETE" }
      );
      setDeleteModalActive(false);
      setServiceToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalActive(false);
    setServiceToDelete(null);
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const resourceName = {
    singular: "service",
    plural: "services",
  };

  const rowMarkup = services.map((service, index) => (
    <IndexTable.Row id={service.id} key={service.id} position={index}>
      <IndexTable.Cell>{service.title}</IndexTable.Cell>
      <IndexTable.Cell>
        {truncateText(service.description)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Link to={`/app/services/${service.id}/edit`}>
            <Button size="slim">Edit</Button>
          </Link>
          <Button
            size="slim"
            variant="primary"
            tone="critical"
            onClick={() => handleDeleteClick(service)}
            loading={fetcher.state === "submitting" && serviceToDelete?.id === service.id}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first service"
      action={{
        content: "New Service",
        onAction: handleNewService,
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start by adding a service to your collection.</p>
    </EmptyState>
  );

  return (
    <AppProvider>
      <Page
      title="Services"
      primaryAction={{
        content: "New Service",
        onAction: handleNewService,
      }}
    >
      <Card padding="0">
        {services.length === 0 ? (
          emptyStateMarkup
        ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={services.length}
            headings={[
              { title: "Title" },
              { title: "Description" },
              { title: "Actions" },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Card>

      <Modal
        open={deleteModalActive}
        onClose={handleDeleteCancel}
        title="Delete service"
        primaryAction={{
          content: "Delete",
          onAction: handleDeleteConfirm,
          destructive: true,
          loading: fetcher.state === "submitting",
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
            Are you sure you want to delete &#34;{serviceToDelete?.title}&#34;? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      </Page>
    </AppProvider>
  );
}
