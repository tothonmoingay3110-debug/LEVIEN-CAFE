export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      site_content: {
        Row: {
          id: string;
          singleton_key: string;
          store_name: string;
          tagline: string;
          logo_url: string | null;
          announcement: string | null;
          about_title: string | null;
          about_text: string | null;
          about_image_url: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          opening_hours: string | null;
          map_url: string | null;
          footer_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["site_content"]["Row"]> & {
          singleton_key?: string;
          store_name?: string;
          tagline?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_content"]["Insert"]>;
        Relationships: [];
      };
      categories: GenericCatalogRow<{ icon: string; sort_order: number }>;
      toppings: GenericCatalogRow<{ price: number }>;
      products: GenericCatalogRow<{
        category_id: string | null;
        description: string | null;
        price: number;
        image_url: string | null;
        emoji: string;
        allow_ice: boolean;
        allow_sugar: boolean;
        allow_toppings: boolean;
        best_seller: boolean;
        must_try: boolean;
        featured: boolean;
        is_new: boolean;
        sold_out: boolean;
        sort_order: number;
      }>;
      product_toppings: JunctionRow<"product_id", "topping_id">;
      combos: GenericCatalogRow<{
        description: string | null;
        price: number;
        image_url: string | null;
        sort_order: number;
      }>;
      combo_products: JunctionRow<"combo_id", "product_id"> & {
        Row: { combo_id: string; product_id: string; position: number };
        Insert: { combo_id: string; product_id: string; position?: number };
        Update: { combo_id?: string; product_id?: string; position?: number };
      };
      promotions: GenericCatalogRow<{
        eyebrow: string | null;
        description: string | null;
        price_text: string | null;
        image_url: string | null;
        sort_order: number;
      }>;
      promotion_events: {
        Row: {
          id: string;
          promotion_id: string;
          event_type: "impression" | "click";
          session_key: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["promotion_events"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          role: "owner" | "manager" | "supervisor" | "staff";
          active: boolean;
          phone: string;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          role?: "owner" | "manager" | "supervisor" | "staff";
          active?: boolean;
          phone?: string;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_profiles"]["Insert"]>;
        Relationships: [];
      };
      staff_compensation: {
        Row: {
          id: string;
          staff_id: string;
          hourly_rate: number;
          weekly_hours: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          hourly_rate?: number;
          weekly_hours?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_compensation"]["Insert"]>;
        Relationships: [];
      };
      staff_shift_requests: {
        Row: {
          id: string;
          staff_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          note: string;
          status: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          note?: string;
          status?: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_shift_requests"]["Insert"]>;
        Relationships: [];
      };
      staff_shifts: {
        Row: {
          id: string;
          staff_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          position: string;
          note: string;
          status: "scheduled" | "cancelled";
          source_request_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          position?: string;
          note?: string;
          status?: "scheduled" | "cancelled";
          source_request_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_shifts"]["Insert"]>;
        Relationships: [];
      };
      staff_time_off_requests: {
        Row: {
          id: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          status: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          reason?: string;
          status?: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_time_off_requests"]["Insert"]>;
        Relationships: [];
      };
      staff_notifications: {
        Row: {
          id: string;
          staff_id: string;
          notification_type: "schedule" | "swap" | "time_off" | "system";
          title: string;
          message: string;
          link: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          notification_type?: "schedule" | "swap" | "time_off" | "system";
          title: string;
          message?: string;
          link?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_notifications"]["Insert"]>;
        Relationships: [];
      };
      staff_shift_swap_requests: {
        Row: {
          id: string;
          shift_id: string;
          requester_id: string;
          offered_to: string;
          note: string;
          status: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          requester_id: string;
          offered_to: string;
          note?: string;
          status?: "pending" | "approved" | "declined" | "cancelled";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_shift_swap_requests"]["Insert"]>;
        Relationships: [];
      };
      staff_audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          summary: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          summary: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_audit_log"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          phone_normalized: string;
          phone_display: string;
          first_name: string;
          last_name: string;
          email: string | null;
          first_order_at: string | null;
          last_order_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone_normalized: string;
          phone_display: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          first_order_at?: string | null;
          last_order_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          id: string;
          auth_user_id: string;
          legacy_customer_id: string | null;
          email: string;
          first_name: string;
          last_name: string;
          phone: string;
          membership_number: string;
          email_verified_at: string | null;
          marketing_opt_in: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          legacy_customer_id?: string | null;
          email: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          membership_number?: string;
          email_verified_at?: string | null;
          marketing_opt_in?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_profiles"]["Insert"]>;
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          subject: string;
          message: string;
          status: "new" | "in_progress" | "resolved" | "archived";
          admin_note: string;
          handled_by: string | null;
          handled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contact_messages"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_messages"]["Insert"]>;
        Relationships: [];
      };
      gift_cards: {
        Row: {
          id: string;
          code_hash: string;
          code_last_four: string;
          code_ciphertext: string | null;
          initial_balance: number;
          balance: number;
          currency: string;
          recipient_name: string;
          recipient_email: string | null;
          note: string;
          status: "active" | "disabled" | "redeemed";
          expires_on: string | null;
          issued_by: string | null;
          owner_profile_id: string | null;
          sale_id: string | null;
          source: "legacy" | "online" | "in_store" | "complimentary";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gift_cards"]["Row"], "id" | "code_ciphertext" | "owner_profile_id" | "sale_id" | "source" | "created_at" | "updated_at"> & {
          id?: string;
          code_ciphertext?: string | null;
          owner_profile_id?: string | null;
          sale_id?: string | null;
          source?: Database["public"]["Tables"]["gift_cards"]["Row"]["source"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_cards"]["Insert"]>;
        Relationships: [];
      };
      gift_card_sales: {
        Row: {
          id: string;
          purchaser_profile_id: string | null;
          purchaser_email: string;
          recipient_name: string;
          recipient_email: string;
          personal_message: string;
          amount: number;
          currency: string;
          sales_channel: "online" | "in_store" | "complimentary";
          status: "pending" | "paid" | "failed" | "expired" | "refunded" | "refund_review";
          tender_type: "stripe" | "cash" | "card_terminal" | "complimentary";
          receipt_reference: string;
          pending_code_hash: string;
          pending_code_last_four: string;
          pending_code_ciphertext: string;
          gift_card_id: string | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          delivery_status: "pending" | "sent" | "manual_required" | "failed";
          delivery_provider_id: string | null;
          paid_at: string | null;
          refunded_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gift_card_sales"]["Row"], "id" | "currency" | "status" | "delivery_status" | "gift_card_id" | "stripe_checkout_session_id" | "stripe_payment_intent_id" | "delivery_provider_id" | "paid_at" | "refunded_at" | "created_by" | "created_at" | "updated_at"> & {
          id?: string;
          currency?: string;
          status?: Database["public"]["Tables"]["gift_card_sales"]["Row"]["status"];
          delivery_status?: Database["public"]["Tables"]["gift_card_sales"]["Row"]["delivery_status"];
          gift_card_id?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          delivery_provider_id?: string | null;
          paid_at?: string | null;
          refunded_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_card_sales"]["Insert"]>;
        Relationships: [];
      };
      gift_card_transactions: {
        Row: {
          id: string;
          gift_card_id: string;
          transaction_type: "issue" | "redeem" | "refund";
          amount: number;
          balance_after: number;
          order_id: string | null;
          created_by: string | null;
          note: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gift_card_transactions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_card_transactions"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string | null;
          provider: "stripe" | "offline" | "gift_card";
          status: "pending" | "unpaid" | "paid" | "failed" | "expired" | "refunded";
          amount: number;
          currency: string;
          provider_session_id: string | null;
          provider_payment_id: string | null;
          failure_message: string;
          paid_at: string | null;
          refunded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "currency" | "failure_message" | "paid_at" | "refunded_at" | "created_at" | "updated_at"> & {
          id?: string;
          currency?: string;
          failure_message?: string;
          paid_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      stripe_webhook_events: {
        Row: { event_id: string; event_type: string; object_id: string; processed_at: string };
        Insert: { event_id: string; event_type: string; object_id?: string; processed_at?: string };
        Update: never;
        Relationships: [];
      };
      loyalty_rules: {
        Row: {
          id: string;
          name: string;
          description: string;
          trigger_product_id: string;
          required_quantity: number;
          reward_type: "free_product" | "physical_gift";
          reward_product_id: string | null;
          reward_name: string;
          repeatable: boolean;
          reward_expires_days: number;
          active: boolean;
          starts_on: string;
          ends_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["loyalty_rules"]["Row"], "id" | "description" | "repeatable" | "reward_expires_days" | "active" | "starts_on" | "ends_on" | "created_by" | "created_at" | "updated_at"> & {
          id?: string;
          description?: string;
          repeatable?: boolean;
          reward_expires_days?: number;
          active?: boolean;
          starts_on?: string;
          ends_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["loyalty_rules"]["Insert"]>;
        Relationships: [];
      };
      loyalty_progress: {
        Row: {
          id: string;
          customer_profile_id: string;
          rule_id: string;
          units_earned: number;
          review_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["loyalty_progress"]["Row"], "id" | "units_earned" | "review_required" | "created_at" | "updated_at"> & {
          id?: string;
          units_earned?: number;
          review_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["loyalty_progress"]["Insert"]>;
        Relationships: [];
      };
      loyalty_rewards: {
        Row: {
          id: string;
          customer_profile_id: string;
          rule_id: string;
          reward_code: string;
          reward_type: "free_product" | "physical_gift";
          reward_product_id: string | null;
          reward_name: string;
          status: "issued" | "reserved" | "redeemed" | "revoked" | "expired";
          source_order_id: string | null;
          redemption_order_id: string | null;
          redeemed_by: string | null;
          issued_at: string;
          expires_at: string | null;
          redeemed_at: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["loyalty_rewards"]["Row"], "id" | "reward_code" | "status" | "issued_at" | "updated_at"> & {
          id?: string;
          reward_code?: string;
          status?: Database["public"]["Tables"]["loyalty_rewards"]["Row"]["status"];
          issued_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["loyalty_rewards"]["Insert"]>;
        Relationships: [];
      };
      loyalty_ledger: {
        Row: {
          id: string;
          customer_profile_id: string;
          rule_id: string;
          order_id: string;
          entry_type: "earn" | "reversal";
          units: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["loyalty_ledger"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string | null;
          customer_profile_id: string | null;
          first_name: string;
          last_name: string;
          phone: string;
          phone_normalized: string;
          email: string | null;
          fulfillment_type: "Pickup" | "Delivery";
          pickup_time: string | null;
          address: string | null;
          city: string | null;
          zip: string | null;
          apartment: string | null;
          payment_method: string;
          payment_status: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refunded";
          payment_provider: "offline" | "stripe" | "gift_card" | "mixed";
          amount_due: number;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          gift_card_id: string | null;
          gift_card_amount: number;
          promotion_id: string | null;
          loyalty_reward_id: string | null;
          loyalty_discount: number;
          subtotal: number;
          tax: number;
          delivery_fee: number;
          total: number;
          status: "Pending Payment" | "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at" | "customer_profile_id" | "payment_status" | "payment_provider" | "amount_due" | "stripe_checkout_session_id" | "stripe_payment_intent_id" | "gift_card_id" | "gift_card_amount" | "promotion_id" | "loyalty_reward_id" | "loyalty_discount"> & {
          id?: string;
          customer_profile_id?: string | null;
          payment_status?: Database["public"]["Tables"]["orders"]["Row"]["payment_status"];
          payment_provider?: Database["public"]["Tables"]["orders"]["Row"]["payment_provider"];
          amount_due?: number;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          gift_card_id?: string | null;
          gift_card_amount?: number;
          promotion_id?: string | null;
          loyalty_reward_id?: string | null;
          loyalty_discount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_items: GenericOrderItemRow;
      order_item_toppings: OrderToppingRow<"order_item_id">;
      order_combo_items: GenericComboChildRow;
      order_combo_item_toppings: OrderToppingRow<"order_combo_item_id">;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_checkout_order: {
        Args: {
          p_first_name: string; p_last_name: string; p_phone: string;
          p_phone_normalized: string; p_email: string | null;
          p_fulfillment_type: "Pickup" | "Delivery"; p_pickup_time: string | null;
          p_address: string | null; p_city: string | null; p_zip: string | null;
          p_apartment: string | null; p_payment_method: string; p_subtotal: number;
          p_tax: number; p_delivery_fee: number; p_total: number; p_note: string;
          p_items: Json;
        };
        Returns: { order_number: string }[];
      };
      create_checkout_order_with_gift_card: {
        Args: {
          p_first_name: string; p_last_name: string; p_phone: string;
          p_phone_normalized: string; p_email: string | null;
          p_fulfillment_type: "Pickup" | "Delivery"; p_pickup_time: string | null;
          p_address: string | null; p_city: string | null; p_zip: string | null;
          p_apartment: string | null; p_payment_method: string; p_subtotal: number;
          p_tax: number; p_delivery_fee: number; p_total: number; p_note: string;
          p_items: Json; p_gift_card_hash: string | null;
        };
        Returns: {
          order_number: string;
          gift_card_amount: number;
          gift_card_balance: number | null;
          final_payment_method: string;
        }[];
      };
      create_checkout_order_v3: {
        Args: {
          p_first_name: string; p_last_name: string; p_phone: string;
          p_phone_normalized: string; p_email: string | null;
          p_fulfillment_type: "Pickup" | "Delivery"; p_pickup_time: string | null;
          p_address: string | null; p_city: string | null; p_zip: string | null;
          p_apartment: string | null; p_payment_method: string; p_subtotal: number;
          p_tax: number; p_delivery_fee: number; p_total: number; p_note: string;
          p_items: Json; p_gift_card_hash: string | null;
          p_customer_profile_id: string | null; p_payment_channel: "offline" | "stripe";
          p_loyalty_reward_id: string | null;
        };
        Returns: {
          order_number: string;
          order_id: string;
          gift_card_amount: number;
          gift_card_balance: number | null;
          loyalty_discount: number;
          amount_due: number;
          payment_status: string;
          final_payment_method: string;
        }[];
      };
      issue_gift_card_v3: {
        Args: {
          p_code_hash: string; p_code_last_four: string; p_code_ciphertext: string;
          p_amount: number; p_recipient_name: string; p_recipient_email: string;
          p_note: string; p_expires_on: string | null; p_tender_type: string;
          p_receipt_reference: string; p_created_by: string | null; p_purchaser_email: string;
        };
        Returns: Array<{ gift_card_id: string; sale_id: string }>;
      };
      issue_gift_card: {
        Args: {
          p_code_hash: string;
          p_code_last_four: string;
          p_initial_balance: number;
          p_recipient_name: string;
          p_recipient_email: string | null;
          p_note: string;
          p_expires_on: string | null;
          p_issued_by: string | null;
        };
        Returns: { gift_card_id: string }[];
      };
      update_order_status_with_gift_card: {
        Args: { p_order_number: string; p_status: string; p_actor_id: string | null };
        Returns: { order_number: string; order_status: string; gift_card_refund: number }[];
      };
      update_order_status_v3: {
        Args: { p_order_number: string; p_status: string; p_actor_id: string | null; p_stripe_refunded?: boolean };
        Returns: {
          order_number: string;
          order_status: string;
          gift_card_refund: number;
          loyalty_reward_restored: boolean;
          rewards_issued: number;
        }[];
      };
      process_stripe_order_event: {
        Args: {
          p_event_id: string; p_event_type: string; p_session_id: string | null;
          p_payment_intent_id: string | null; p_amount_cents: number;
        };
        Returns: { processed: boolean; order_number: string; order_id: string }[];
      };
      fulfill_gift_card_sale: {
        Args: {
          p_event_id: string; p_event_type: string; p_session_id: string | null;
          p_payment_intent_id: string | null; p_amount_cents: number;
        };
        Returns: { processed: boolean; sale_id: string; gift_card_id: string | null }[];
      };
      sync_customer_profile_orders: {
        Args: { p_customer_profile_id: string };
        Returns: number;
      };
      save_admin_catalog: {
        Args: { p_catalog: Json };
        Returns: undefined;
      };
    };
    Enums: {
      staff_role: "owner" | "manager" | "supervisor" | "staff";
      shift_swap_status: "pending" | "approved" | "declined" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type GenericCatalogRow<Extra extends Record<string, unknown>> = {
  Row: {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
  } & Extra;
  Insert: Partial<{
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
  } & Extra> & { name: string };
  Update: Partial<GenericCatalogRow<Extra>["Insert"]>;
  Relationships: [];
};

type JunctionRow<A extends string, B extends string> = {
  Row: Record<A | B, string>;
  Insert: Record<A | B, string>;
  Update: Partial<Record<A | B, string>>;
  Relationships: [];
};

type GenericOrderItemRow = {
  Row: {
    id: string;
    order_id: string;
    line_id: string;
    item_type: "product" | "combo";
    product_id: string | null;
    combo_id: string | null;
    name: string;
    emoji: string;
    base_price: number;
    unit_price: number;
    quantity: number;
    ice: string | null;
    sugar: string | null;
    note: string;
    created_at: string;
  };
  Insert: Omit<GenericOrderItemRow["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
  Update: Partial<GenericOrderItemRow["Insert"]>;
  Relationships: [];
};

type GenericComboChildRow = {
  Row: {
    id: string;
    order_item_id: string;
    product_id: string | null;
    name: string;
    emoji: string;
    position: number;
    ice: string | null;
    sugar: string | null;
    note: string;
    created_at: string;
  };
  Insert: Omit<GenericComboChildRow["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
  Update: Partial<GenericComboChildRow["Insert"]>;
  Relationships: [];
};

type OrderToppingRow<Parent extends string> = {
  Row: Record<Parent, string> & {
    id: string;
    topping_id: string | null;
    topping_name: string;
    topping_price: number;
    created_at: string;
  };
  Insert: Record<Parent, string> & {
    id?: string;
    topping_id?: string | null;
    topping_name: string;
    topping_price: number;
    created_at?: string;
  };
  Update: Partial<OrderToppingRow<Parent>["Insert"]>;
  Relationships: [];
};
