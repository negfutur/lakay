# Lakay domain product model

## Recommended first release

Lakay should offer a **domain launch assistant**, not claim to be a registrar. The application proposes available-looking names only as suggestions, sends the user to an approved registrar or affiliate checkout, and then helps the user connect a domain they own to a published project.

The domain is always owned by the customer. Lakay never stores registrar passwords, registrant identity documents, payment card data, EPP codes, or DNS-provider credentials in the client. Until an approved registrar API is configured, Lakay must not show live availability, final prices, purchase confirmations, or renewal dates as though they were verified.

## Product states

| State | Meaning | User action |
|---|---|---|
| `suggested` | A name and extensions are product suggestions only. | Choose a preferred name. |
| `affiliate_handoff` | Lakay sends the user to an approved registrar checkout. | Buy the domain directly with the registrar. |
| `awaiting_connection` | The user states that they own the domain. | Enter the domain and continue. |
| `dns_instructions_ready` | Lakay provides project-specific DNS records after a deployable release exists. | Add DNS records with the user’s provider. |
| `verifying` | A server-side check is pending or in progress. | Wait or refresh verification. |
| `live` | Ownership and routing were verified against a real published deployment. | Set as primary or manage the connection. |
| `error` | DNS, ownership, or deployment verification failed. | Read the precise recovery action. |

## Future embedded reseller release

An in-product purchase flow may be considered only after a registrar approves a reseller/API partnership and Lakay can safely implement live availability and price retrieval, customer consent, registrant contacts, renewal notices, WHOIS privacy controls, transfer-out support, payment/refund handling, abuse routes, DNS lifecycle, and support ownership.
