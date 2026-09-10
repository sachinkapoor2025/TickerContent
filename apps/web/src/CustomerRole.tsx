import { createContext, useContext, type ReactNode } from "react";
import { customerAccess, type CustomerAccess } from "./customerAccess";

const CustomerRoleContext = createContext("viewer");

export function CustomerRoleProvider({ roleKey, children }: { roleKey: string; children: ReactNode }) {
  return <CustomerRoleContext.Provider value={roleKey}>{children}</CustomerRoleContext.Provider>;
}

export function useCustomerAccess(): CustomerAccess {
  return customerAccess(useContext(CustomerRoleContext));
}
