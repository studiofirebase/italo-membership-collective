ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id text;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_mp_provider_id ON public.subscriptions(provider_subscription_id) WHERE provider = 'mercadopago' AND provider_subscription_id IS NOT NULL;
CREATE TABLE public.mercadopago_checkouts (subscription_id uuid PRIMARY KEY REFERENCES public.subscriptions(id) ON DELETE CASCADE, provider_plan_id text NOT NULL, checkout_url text, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.mercadopago_checkouts TO service_role;
ALTER TABLE public.mercadopago_checkouts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.mercadopago_charges (provider_payment_id text PRIMARY KEY, subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE, status text NOT NULL, approved_at timestamptz, paid_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.mercadopago_charges TO service_role;
ALTER TABLE public.mercadopago_charges ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.subscriptions, public.plans TO service_role;
CREATE OR REPLACE FUNCTION public.apply_mercadopago_charge(p_subscription_id uuid, p_provider_subscription_id text, p_payment_id text, p_status text, p_approved_at timestamptz, p_paid_until timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_until timestamptz;
BEGIN
 PERFORM 1 FROM public.subscriptions WHERE id=p_subscription_id AND provider='mercadopago' AND provider_subscription_id=p_provider_subscription_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription binding mismatch'; END IF;
 INSERT INTO public.mercadopago_charges(provider_payment_id,subscription_id,status,approved_at,paid_until) VALUES(p_payment_id,p_subscription_id,p_status,p_approved_at,p_paid_until)
 ON CONFLICT(provider_payment_id) DO UPDATE SET status=EXCLUDED.status,approved_at=EXCLUDED.approved_at,paid_until=EXCLUDED.paid_until,updated_at=now() WHERE mercadopago_charges.subscription_id=EXCLUDED.subscription_id;
 SELECT max(paid_until) INTO v_until FROM public.mercadopago_charges WHERE subscription_id=p_subscription_id AND status='approved';
 UPDATE public.subscriptions SET status=CASE WHEN v_until>now() THEN 'active' ELSE 'pending' END,expires_at=COALESCE(v_until,now()),started_at=COALESCE(started_at,p_approved_at) WHERE id=p_subscription_id AND status<>'canceled';
END; $$;
REVOKE ALL ON FUNCTION public.apply_mercadopago_charge(uuid,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mercadopago_charge(uuid,text,text,text,timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.get_member_videos() RETURNS SETOF public.videos LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v.id,v.title,v.description,v.thumbnail_url,
 CASE WHEN public.has_role(auth.uid(),'admin') OR
 (v.access_type='subscription' AND EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.user_id=auth.uid() AND s.status='active' AND (s.expires_at IS NULL OR s.expires_at>now()))) OR
 (v.access_type='purchase' AND EXISTS(SELECT 1 FROM public.purchases p WHERE p.user_id=auth.uid() AND p.video_id=v.id AND p.status='paid'))
 THEN v.video_url ELSE NULL END,
 v.access_type,v.price_label,v.purchase_url,v.is_published,v.sort_order,v.created_at
 FROM public.videos v WHERE v.is_published OR public.has_role(auth.uid(),'admin'); $$;
REVOKE ALL ON FUNCTION public.get_member_videos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_videos() TO anon,authenticated,service_role;
REVOKE SELECT ON public.videos FROM anon,authenticated;
GRANT SELECT(id,title,description,thumbnail_url,access_type,price_label,purchase_url,is_published,sort_order,created_at) ON public.videos TO anon,authenticated;