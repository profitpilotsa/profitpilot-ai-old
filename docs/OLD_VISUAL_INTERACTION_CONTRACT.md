# OLD Visual and Interaction Contract

This document records the approved baseline for ProfitPilot OLD. It is a preservation contract, not a redesign brief. Until a separately approved product phase says otherwise, changes must preserve the visible hierarchy, route purpose, navigation order, labels, and interaction intent described here.

## Baseline

- Repository: `profitpilotsa/profitpilot-ai-old`
- Baseline branch: `main`
- Baseline commit: `e0b6a96058d71dccfb4bc2989418a3327ea1fd85`
- Reference experience: `profitpilot-mnnjhzu8.manus.space`
- Visual default: dark ProfitPilot shell.

## Global shell

- The fixed left sidebar contains the brand, selected workspace, grouped navigation, Settings, and the owner summary.
- The top bar shows the breadcrumb, sync status, notifications, search, and mobile menu control.
- A page begins with eyebrow, title, subtitle, and optional primary action.
- Panels, KPI cards, colored source/status badges, bars, charts, tables, and inline actions retain their current spacing, alignment, and visual weight.
- On small screens the sidebar opens from the menu; the page content remains the same route and does not become a different information architecture.

## Sidebar order

1. **Workspace:** Command Center, Decision Center (3), Action Center (4).
2. **Intelligence:** Product Profitability, Inventory Intelligence, Cash-Aware Decision, True Cost Engine.
3. **Costs · التكاليف:** Cost Overview, Product Costs, Shipping Costs, Payment Fees, Packaging Costs, Advertising Costs, Subscriptions, Other Costs.
4. **Business Brain:** Business Brain, AI Analyst.
5. **Marketing · الإعلانات والتسويق:** Marketing Overview, Platforms & Campaigns, Tracking & Analytics.
6. **Footer:** Settings and current user summary.

## Route and page contract

| Route | Page and required content / interactions |
| --- | --- |
| `/` | **Command Center**: monthly KPI row; True Profit snapshot; prioritized attention list; Store Health ring and dimensions; Cash position chart; Business Brain signals; Ask ProfitPilot. |
| `/decisions` | **Decision Center**: critical recommendation, financial impact, quantity adjustment, review breakdown, approval and timeline. |
| `/actions` | **Action Center**: prioritized operational actions and their review/analysis controls. |
| `/products` | **Product Profitability**: KPI context, sortable product list, margin/stock/trend status, selected-product detail, cost components and analysis actions. |
| `/inventory` | **Inventory Intelligence**: product stock health, coverage, reorder risk, priority and product-oriented actions. |
| `/cash` | **Cash-Aware Decision**: cash-aware bar/visualization, reorder scenario, cash floor, projected impact, recommendation and Save Decision. |
| `/true-cost` | **True Cost Engine**: product/order scope, complete cost breakdown, source badges, missing-cost warnings, and profit implication. Missing is never silently presented as zero. |
| `/costs` | **Cost Overview**: store-level overview, grouped cost totals, breakdown and configuration actions. |
| `/cost-settings` | **Product Costs**: product-level cost configuration and edit/add actions. |
| `/shipping-costs` | **Shipping Costs**: management table, filters, row actions and add/edit flow. |
| `/payment-fees` | **Payment Fees**: management table, filters, row actions and add/edit flow. |
| `/packaging-costs` | **Packaging Costs**: management table, filters, row actions and add/edit flow. |
| `/advertising-costs` | **Advertising Costs**: management table, filters, row actions and add/edit flow. |
| `/subscriptions` | **Subscriptions**: subscription costs, status and management actions. |
| `/other-costs` | **Other Costs**: management table, filters, row actions and add/edit flow. |
| `/marketing` | **Marketing Overview**: performance summary, profit-aware marketing insights and drill-downs. |
| `/marketing/platforms` | **Platforms & Campaigns**: platform/campaign comparison, tabs and campaign actions. |
| `/marketing/campaigns` | **Campaigns**: campaign analysis tab of the marketing experience. |
| `/marketing/tracking` | **Tracking & Analytics**: tracking health, filters and analytics view. |
| `/brain` | **Business Brain**: rules, preferences, learned patterns, product/supplier/decision memory and review actions. |
| `/analyst` | **AI Analyst**: analyst conversation area, suggested prompts and answer presentation. |

## Critical interaction contract

- Navigation buttons change only the current route and retain the selected sidebar state.
- Product selection updates the product detail without changing the page hierarchy.
- Filters, tabs, dropdowns, sliders, add/edit controls, row menus, and dialogs retain their labels and purpose.
- Decision and cash flows preserve their visible financial impact, scenario, recommendation, and Save Decision behavior.
- Talk to AI and Ask ProfitPilot stay where the current OLD experience places them; future live responses may change data only, not the surrounding UX.
- Source/provenance labels distinguish Manual, Imported, Calculated, Estimated, and not-configured data.

## Regression rule

Do not import NEW navigation, NEW card layouts, or `DemoWorkspace.tsx`. Any future engine integration must feed this contract from behind the existing UI.
