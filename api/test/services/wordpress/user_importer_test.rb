# frozen_string_literal: true

require "test_helper"

module Wordpress
  class UserImporterTest < ActiveSupport::TestCase
    def records
      [
        { "id" => 9001, "email" => "Reader@Example.com", "login" => "reader1",
          "display_name" => "Reader One", "registered" => "2021-05-01 10:00:00", "roles" => ["subscriber"] },
        { "id" => 9002, "email" => "ed@example.com", "login" => "ed",
          "display_name" => "Ed Editor", "registered" => "2019-01-01 00:00:00", "roles" => ["editor"] },
        { "id" => 9003, "email" => "", "login" => "noemail", "roles" => ["subscriber"] } # invalid
      ]
    end

    test "imports users, mapping roles and normalising email" do
      result = UserImporter.new(records).call
      assert_equal 2, result.created
      assert_equal 1, result.skipped

      reader = User.find_by(legacy_wp_user_id: 9001)
      assert_equal "reader@example.com", reader.email, "email is downcased"
      assert reader.role_reader?, "subscriber maps to reader"
      assert User.find_by(legacy_wp_user_id: 9002).role_editor?
    end

    test "is idempotent and never downgrades an editorial account to reader" do
      UserImporter.new(records).call
      # Re-export where the editor now shows only a subscriber role.
      again = records.map { |r| r["id"] == 9002 ? r.merge("roles" => ["subscriber"]) : r }
      result = UserImporter.new(again).call

      assert_equal 0, result.created
      assert User.find_by(legacy_wp_user_id: 9002).role_editor?, "editor is not downgraded on re-import"
    end
  end
end
