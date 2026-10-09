import { Box } from '@mui/material';
import { PageHeader, EmptyState } from '../components/ui';

/** Reviews have no backend yet (no model, no endpoints) — explicit placeholder
 *  instead of fake data, per integration rules. */
export default function Reviews() {
  return (
    <Box>
      <PageHeader title="Reviews & Reports" sub="Customer reviews live here once the backend supports them." />
      <EmptyState
        message="Awaiting backend integration."
        hint="Needs: Review model (order, customer, restaurant, rating, text, status), admin list/moderate endpoints. The UI (filter by restaurant/rating, hide with reason) will be built on top of those contracts."
      />
    </Box>
  );
}
