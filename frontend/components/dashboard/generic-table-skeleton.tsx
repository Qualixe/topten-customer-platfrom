import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

/** Generic row/column shimmer for a table-shaped `loading.tsx` — used where
 * a page's exact columns aren't worth mirroring one-for-one, just its
 * general shape (a bordered table with N rows), to avoid a blank flash
 * during navigation. */
export function GenericTableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {Array.from({ length: columns }, (_, col) => (
                <TableCell key={col}>
                  <Skeleton className="h-4 w-full max-w-32" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
