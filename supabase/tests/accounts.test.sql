-- Development accounts: the seed must produce accounts GoTrue can authenticate,
-- and stay idempotent when replayed on accounts that already exist.
set search_path = public, extensions;

do $$
declare
  expected constant text[] := array['admin@example.com', 'technicien@example.com', 'client@example.com', 'client2@example.com'];
  mail text;
  usr auth.users%rowtype;
begin
  foreach mail in array expected loop
    select * into usr from auth.users where email = mail;
    assert usr.id is not null, format('account %s is missing', mail);
    assert usr.encrypted_password = crypt('password123', usr.encrypted_password), format('password123 does not authenticate %s', mail);
    assert usr.email_confirmed_at is not null, format('%s is not confirmed: GoTrue would refuse the sign-in', mail);
    assert usr.aud = 'authenticated' and usr.role = 'authenticated', format('%s has a wrong audience/role', mail);
    assert (select count(*) from auth.identities i where i.user_id = usr.id and i.provider = 'email') = 1,
      format('%s has no email identity', mail);
    assert (select count(*) from auth.users u where u.email = mail) = 1, format('%s duplicated by the replayed seed', mail);
  end loop;

  assert (select role from public.profiles where email = 'admin@example.com') = 'SUPER_ADMIN', 'admin is not SUPER_ADMIN';
  assert (select role from public.profiles where email = 'technicien@example.com') = 'TECHNICIAN', 'technician role missing';
  assert (select count(*) from public.technicians t join public.profiles p on p.id = t.profile_id where p.email = 'technicien@example.com') = 1,
    'technician record not linked to the profile';
end $$;

select 'account tests OK' as result;
