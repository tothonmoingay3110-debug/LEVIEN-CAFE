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
          subtotal: number;
          tax: number;
          delivery_fee: number;
          total: number;
          status: "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
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
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
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
