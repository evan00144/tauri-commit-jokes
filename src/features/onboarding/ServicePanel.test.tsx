import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServicePanel } from "./ApiKeyForm";

describe("ServicePanel", () => {
  it("does not expose base url or model details in the default service panel", () => {
    render(
      <ServicePanel
        serviceStatus={{
          ok: true,
          serviceName: "svc",
          modelName: "gpt",
          baseUrl: "https://example.com",
          errorCode: null,
        }}
        refreshingService={false}
        inlineError={null}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.queryByText(/base url/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server model/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no local api key required/i)).toBeInTheDocument();
  });
});
