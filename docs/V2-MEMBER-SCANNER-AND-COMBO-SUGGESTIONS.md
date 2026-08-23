# V2 Member Scanner and Module 8 Combo Suggestions

## Member Scanner

Admin → Overview → Scan Member is available to Owner, Manager, Supervisor and
Staff accounts that have order access.

Supported input methods:

1. Device camera in a browser that exposes the native QR detector.
2. A USB or Bluetooth 2D scanner configured in HID keyboard mode with Enter as
   the suffix.
3. Manual entry of the `LV-XXXXXXXXXX` member number.

The QR contains `LEVIEN-MEMBER:<membership number>`. It contains no name, email,
phone, reward or order information. The protected Admin API resolves the member
after verifying the staff session.

The result shows identity, linked-order count, current loyalty progress and
available rewards. Counter redemption:

- requires a second staff confirmation;
- updates only an issued, unexpired reward belonging to the scanned member;
- records the staff account and redemption timestamp;
- creates an audit-log entry;
- cannot accidentally redeem the same reward twice.

The scanner is a POS-independent companion. It does not import purchases from a
separate POS yet. A future POS adapter should map the external receipt ID and POS
SKU to LEVIEN products before awarding progress.

## Module 8: Combo Suggestions

Admin → Customers & Store → Combo Suggestions is restricted to Owner and
Manager through the existing `manage_catalog` permission.

The engine is deterministic and explainable. It analyzes completed orders in a
30, 90, 180-day or all-time window and counts independent products purchased in
the same order. It excludes:

- cancelled, unpaid or incomplete orders;
- items already purchased as part of a combo;
- inactive or sold-out products;
- pairs already present in an existing combo.

Each recommendation includes:

- order co-occurrence count;
- confidence: how often the less-frequent product appears with the other;
- support: the percentage of analyzed orders containing the pair;
- an explainable ranking score and Early/Growing/Strong signal;
- regular total and a draft price near 10% savings.

“Create Draft Combo” writes an inactive combo through the existing protected
catalog save path. A Manager must review the name, description, price, image and
included products before publishing it. Suggestions never publish storefront
content automatically and do not send customer data to an external AI service.

## Acceptance tests

1. Sign in as Staff and confirm Scan Member is available but catalog tools are
   not.
2. Scan a valid membership QR with a 2D HID scanner and confirm Enter performs
   the lookup.
3. Scan the same card through a supported phone camera.
4. Enter an invalid or unknown number and confirm no customer data appears.
5. Redeem an issued reward and confirm a second attempt is rejected.
6. Sign in as Manager, complete several orders with two independent products,
   and confirm the pair appears in Combo Suggestions.
7. Create a suggested draft and confirm it appears under Combos as Hidden.
8. Review and publish the combo, then confirm the storefront receives it through
   the existing catalog synchronization.

No new SQL migration is required for this release.
