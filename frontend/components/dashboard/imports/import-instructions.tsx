"use client";

import { Download, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MAX_FILE_SIZE_BYTES, REQUIRED_COLUMNS } from "@/lib/mock/imports";

const TEMPLATE_CSV = `${REQUIRED_COLUMNS.join(",")}\nRahim Uddin,01711000101,5000\n`;

function handleDownloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "customer_import_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportInstructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Instructions</CardTitle>
        <CardDescription>Format your file before uploading</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <p className="text-sm font-medium">Required columns</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REQUIRED_COLUMNS.map((column) => (
              <Badge key={column} variant="outline">
                {column}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            File must be a <span className="font-medium text-foreground">.csv</span>{" "}
            with a header row matching the column names above.
          </li>
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Maximum file size is{" "}
            <span className="font-medium text-foreground">
              {Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB
            </span>
            .
          </li>
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Matched by phone number: a phone already on file updates that
            customer instead of creating a duplicate.
          </li>
        </ul>

        <Button variant="outline" className="mt-auto" onClick={handleDownloadTemplate}>
          <Download />
          Download Template
        </Button>
      </CardContent>
    </Card>
  );
}
