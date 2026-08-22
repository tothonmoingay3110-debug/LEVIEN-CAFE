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
          initial_balance: number;
          balance: number;
          currency: string;
          recipient_name: string;
          recipient_email: string | null;
          note: string;
          status: "active" | "disabled" | "redeemed";
          expires_on: string | null;
          issued_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gift_cards"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_cards"]["Insert"]>;
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
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string | null;
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
          gift_card_id: string | null;
          gift_card_amount: number;
          subtotal: number;
          tax: number;
          delivery_fee: number;
          total: number;
          status: "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at" | "gift_card_id" | "gift_card_amount"> & {
          id?: string;
          gift_card_id?: string | null;
          gift_card_amount?: number;
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
