// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateField } from "./DateFields";

afterEach(cleanup);
const ano = new Date().getFullYear();
function digitar(texto: string) {
  const onChange = vi.fn();
  render(<DateField value="" onChange={onChange} aria-label="data" />);
  const campo = screen.getByLabelText("data");
  fireEvent.change(campo, { target: { value: texto } });
  return { onChange, campo };
}

describe("DateField aceita data curta", () => {
  it("12/10 + Enter vale com o ano de hoje", () => {
    const { onChange, campo } = digitar("12/10");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: `${ano}-10-12` } }));
  });
  it("12/10/26 + Enter vale como 2026", () => {
    const { onChange, campo } = digitar("12/10/26");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: "2026-10-12" } }));
  });
  it("sair do campo com 12/10 também vale", () => {
    const { onChange, campo } = digitar("12/10");
    fireEvent.blur(campo);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: `${ano}-10-12` } }));
  });
});
