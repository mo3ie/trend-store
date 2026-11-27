-- 46 — «الجمعة البيضاء»: a crossed-out "before" price per product.
--
-- products.old_price  — optional. Shown struck-through next to `price` (the price the
-- customer actually pays) only when it is HIGHER than price. Clearing it ends the offer
-- for that product. Prices stay manual: nothing computes either number.
--
-- The POS → storefront sync (pos_sync_product_to_store) copies the POS sale price
-- into products.price on every POS change. During an offer that would silently undo
-- the manually set sale price, so while old_price is set the storefront price is kept;
-- quantity/name/images still sync exactly as before.

alter table public.products add column if not exists old_price numeric;

create or replace function public.pos_sync_product_to_store()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_qty int; v_imgs text[]; v_store uuid; v_bname text; v_sum int;
begin
  if new.store_product_id is null then return new; end if;
  v_store := new.store_product_id::uuid;
  v_qty := least(greatest(0, floor(coalesce(new.quantity,0))), 2000000000)::int;
  select name into v_bname from pos_branches where id = new.branch_id;

  if new.deleted_at is not null then
    update product_branches set quantity = 0, updated_at = now()
      where product_id = v_store and branch_id = new.branch_id;
  else
    insert into product_branches (product_id, branch_id, branch_name, quantity, updated_at)
    values (v_store, new.branch_id, v_bname, v_qty, now())
    on conflict (product_id, branch_id)
      do update set quantity = excluded.quantity, branch_name = excluded.branch_name, updated_at = now();
  end if;

  select coalesce(sum(quantity),0)::int into v_sum from product_branches where product_id = v_store;

  begin
    select array_agg(value) into v_imgs from jsonb_array_elements_text(new.images_json::jsonb);
  exception when others then v_imgs := null; end;

  if new.deleted_at is not null then
    update products set stock = v_sum, quantity = v_sum, is_available = v_sum > 0 where id = v_store;
  else
    update products
       set name = new.name,
           -- an offer is running on this product (old_price set) → keep the manual sale price
           price = case when products.old_price is not null then products.price else new.sale_price end,
           stock = v_sum, quantity = v_sum, is_available = v_sum > 0,
           image_url = coalesce(new.image_url, image_url),
           images = coalesce(v_imgs, images)
     where id = v_store;
  end if;
  return new;
end;
$function$;
