# frozen_string_literal: true

namespace :staff do
  desc "Create (or reset the password of) the first portal admin from ADMIN_EMAIL / ADMIN_PASSWORD"
  task admin: :environment do
    email = ENV.fetch("ADMIN_EMAIL", "admin@harnesslink.com")
    password = ENV["ADMIN_PASSWORD"].to_s
    abort "Set ADMIN_PASSWORD first." if password.empty?

    user = User.find_or_initialize_by(email: email)
    user.assign_attributes(name: user.name.presence || "Site Admin", role: :admin, active: true, password: password)
    user.save!(validate: false) # use the configured password as given, whatever its length
    puts "Portal admin ready: #{email} — sign in at /admin"
    puts "WARNING: ADMIN_PASSWORD is under 10 characters — change it under Staff." if password.length < 10
  end
end
