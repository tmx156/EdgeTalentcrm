-- Reset CSV leads back to "New" status
-- Run this SQL directly in the Supabase SQL Editor
-- This bypasses all triggers and RLS policies

-- Temporarily disable triggers (if you have permission)
-- ALTER TABLE leads DISABLE TRIGGER ALL;

-- Update all leads from the CSV back to "New" status
UPDATE leads
SET 
  status = 'New',
  booker_id = NULL,
  assigned_at = NULL,
  date_booked = NULL,
  booked_at = NULL,
  is_confirmed = 0,
  booking_status = NULL,
  updated_at = NOW()
WHERE LOWER(email) IN (
  'andreacarless@yahoo.com',
  'dawnmarkscooby505@yahoo.com',
  'jeanettemair1963@gmail.com',
  'paulogilvie@live.co.uk',
  'paulinesutton15@gmail.com',
  'hhughes76@hotmail.co.uk',
  'sazzymodel@gmail.com',
  'dpassey6@googlemail.com',
  'nevin.curpen@googlemail.com',
  'annemariebrd@yahoo.ca',
  'justin212426@yahoo.com',
  'shellylouiseferney1278@gmail.com',
  'janeellisdale@hotmail.com',
  'becx42@icloud.com',
  'anueta@ntlworld.com',
  'patbuchan@sky.com',
  'karlfaulconbridge52@gmail.com',
  'terri@thesmartcorporation.com',
  'lienegotlande@inbox.lv',
  'sylviagilbert59@googlemail.com',
  'nabirkett@hotmail.co.uk',
  'balogivan25@gmail.com',
  'ange1bayliss@yahoo.co.uk',
  'nickbevington1@gmail.com',
  'cathlowe23@gmail.com',
  'ianwilliamshawkins@gmail.com',
  'tracy412012@gmail.com',
  'maxinelindsay37@gmail.com',
  'lesdmoore@aol.com',
  'pearson2006@hotmail.co.uk',
  'carloalexandreteix@gmail.com',
  'karenknoxx@icloud.com',
  'sheidubuhari@yahoo.com',
  'grunders207@yahoo.co.uk',
  'jennyfenny1@gmail.com',
  'waynesinclair06@gmail.com',
  'bevsy128@gmail.com',
  'dianne.lamb2@btinternet.com',
  'loobyloo75@hotmail.co.uk',
  'a.klarisszamenyhart@gmail.com'
);

-- Re-enable triggers (if you disabled them)
-- ALTER TABLE leads ENABLE TRIGGER ALL;

-- Check how many leads were updated
SELECT 
  'Total leads reset:' as message,
  COUNT(*) as count
FROM leads
WHERE LOWER(email) IN (
  'andreacarless@yahoo.com',
  'dawnmarkscooby505@yahoo.com',
  'jeanettemair1963@gmail.com',
  'paulogilvie@live.co.uk',
  'paulinesutton15@gmail.com',
  'hhughes76@hotmail.co.uk',
  'sazzymodel@gmail.com',
  'dpassey6@googlemail.com',
  'nevin.curpen@googlemail.com',
  'annemariebrd@yahoo.ca',
  'justin212426@yahoo.com',
  'shellylouiseferney1278@gmail.com',
  'janeellisdale@hotmail.com',
  'becx42@icloud.com',
  'anueta@ntlworld.com',
  'patbuchan@sky.com',
  'karlfaulconbridge52@gmail.com',
  'terri@thesmartcorporation.com',
  'lienegotlande@inbox.lv',
  'sylviagilbert59@googlemail.com',
  'nabirkett@hotmail.co.uk',
  'balogivan25@gmail.com',
  'ange1bayliss@yahoo.co.uk',
  'nickbevington1@gmail.com',
  'cathlowe23@gmail.com',
  'ianwilliamshawkins@gmail.com',
  'tracy412012@gmail.com',
  'maxinelindsay37@gmail.com',
  'lesdmoore@aol.com',
  'pearson2006@hotmail.co.uk',
  'carloalexandreteix@gmail.com',
  'karenknoxx@icloud.com',
  'sheidubuhari@yahoo.com',
  'grunders207@yahoo.co.uk',
  'jennyfenny1@gmail.com',
  'waynesinclair06@gmail.com',
  'bevsy128@gmail.com',
  'dianne.lamb2@btinternet.com',
  'loobyloo75@hotmail.co.uk',
  'a.klarisszamenyhart@gmail.com'
)
AND status = 'New';

-- Show the leads that were reset
SELECT 
  id,
  name,
  email,
  status,
  booker_id,
  assigned_at,
  date_booked
FROM leads
WHERE LOWER(email) IN (
  'andreacarless@yahoo.com',
  'dawnmarkscooby505@yahoo.com',
  'jeanettemair1963@gmail.com',
  'paulogilvie@live.co.uk',
  'paulinesutton15@gmail.com',
  'hhughes76@hotmail.co.uk',
  'sazzymodel@gmail.com',
  'dpassey6@googlemail.com',
  'nevin.curpen@googlemail.com',
  'annemariebrd@yahoo.ca',
  'justin212426@yahoo.com',
  'shellylouiseferney1278@gmail.com',
  'janeellisdale@hotmail.com',
  'becx42@icloud.com',
  'anueta@ntlworld.com',
  'patbuchan@sky.com',
  'karlfaulconbridge52@gmail.com',
  'terri@thesmartcorporation.com',
  'lienegotlande@inbox.lv',
  'sylviagilbert59@googlemail.com',
  'nabirkett@hotmail.co.uk',
  'balogivan25@gmail.com',
  'ange1bayliss@yahoo.co.uk',
  'nickbevington1@gmail.com',
  'cathlowe23@gmail.com',
  'ianwilliamshawkins@gmail.com',
  'tracy412012@gmail.com',
  'maxinelindsay37@gmail.com',
  'lesdmoore@aol.com',
  'pearson2006@hotmail.co.uk',
  'carloalexandreteix@gmail.com',
  'karenknoxx@icloud.com',
  'sheidubuhari@yahoo.com',
  'grunders207@yahoo.co.uk',
  'jennyfenny1@gmail.com',
  'waynesinclair06@gmail.com',
  'bevsy128@gmail.com',
  'dianne.lamb2@btinternet.com',
  'loobyloo75@hotmail.co.uk',
  'a.klarisszamenyhart@gmail.com'
)
ORDER BY name;

