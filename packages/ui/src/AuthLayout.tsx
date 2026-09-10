import type { ReactNode } from "react";

export function AuthLayout({
  productLabel,
  title,
  children,
}: {
  productLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="pp-auth">
      <div className="pp-auth__box">
        <p className="pp-auth__product">{productLabel}</p>
        <h1 className="pp-auth__title">{title}</h1>
        {children}
      </div>
    </div>
  );
}
