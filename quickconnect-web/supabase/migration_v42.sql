-- migration_v42.sql
-- Notify matching providers in real-time when a new "Looking For" post is created.
-- Only providers with an active service in the same category receive the notification.

CREATE OR REPLACE FUNCTION public.notify_providers_new_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_post_title    TEXT;
  v_category_name TEXT;
  v_provider      RECORD;
BEGIN
  -- Customer display name
  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  v_post_title := left(COALESCE(NEW.title, 'a new job'), 80);

  -- Category label (may be NULL if post has no category)
  IF NEW.category_id IS NOT NULL THEN
    SELECT name INTO v_category_name
    FROM public.service_categories
    WHERE id = NEW.category_id;
  END IF;

  -- Notify every active provider whose services cover this category.
  -- If no category is set on the post, notify all active providers.
  FOR v_provider IN
    SELECT DISTINCT sp.profile_id
    FROM public.service_providers sp
    JOIN public.services s
      ON s.provider_id = sp.id
     AND s.is_active = TRUE
    WHERE (NEW.category_id IS NULL OR s.category_id = NEW.category_id)
      AND sp.profile_id != NEW.customer_id   -- skip if the poster is also a provider
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_provider.profile_id,
      'new_post',
      'New opportunity' ||
        CASE WHEN v_category_name IS NOT NULL
             THEN ': ' || v_category_name
             ELSE ''
        END,
      format('%s is looking for help — "%s"', v_customer_name, v_post_title),
      jsonb_build_object(
        'post_id', NEW.id::text,
        'path',    '/looking-for/' || NEW.id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_looking_for_posts_after_insert_notify ON public.looking_for_posts;
CREATE TRIGGER trg_looking_for_posts_after_insert_notify
  AFTER INSERT ON public.looking_for_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_providers_new_opportunity();
