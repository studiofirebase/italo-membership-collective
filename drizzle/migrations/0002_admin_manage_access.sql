grant update, delete on public.subscriptions to authenticated;
grant update, delete on public.purchases to authenticated;

create policy "Admins manage subscriptions" on public.subscriptions for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete subscriptions" on public.subscriptions for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage purchases" on public.purchases for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete purchases" on public.purchases for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.profiles to authenticated;