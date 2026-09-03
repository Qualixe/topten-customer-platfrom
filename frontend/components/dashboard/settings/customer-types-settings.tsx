"use client";

import { useEffect, useState } from "react";

import { CustomerTypesManager } from "@/components/dashboard/customers/manage-customer-types-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { getErrorMessage } from "@/lib/api/types";

/** The canonical place to manage customer types: add new ones, rename
 * custom ones, and switch any non-built-in type active/inactive. There is
 * no delete — an inactive type just stops appearing in the "Customer Type"
 * picker on the add/edit customer forms, without breaking any customer or
 * import batch that already references it. */
export function CustomerTypesSettings() {
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCustomerTypes()
      .then((fetched) => {
        if (!cancelled) setTypes(fetched);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Types</CardTitle>
        <CardDescription>
          The categories customers can be labeled with (General, VIP, VVIP, and anything else you
          add). Used for filtering and campaign targeting — retiring one only hides it from new
          assignments, it never deletes history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <CustomerTypesManager types={types} onTypesChange={setTypes} />
        )}
      </CardContent>
    </Card>
  );
}
