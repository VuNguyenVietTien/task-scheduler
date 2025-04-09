Table Indexes
============

Table name: activity_logs
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
activity_logs_pkey          |CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id)     |
idx_activity_logs_user      |CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id)   |
idx_activity_logs_project   |CREATE INDEX idx_activity_logs_project ON public.activity_logs USING btree (project_id) |
idx_activity_logs_task      |CREATE INDEX idx_activity_logs_task ON public.activity_logs USING btree (task_id)   |

Table name: attachments
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
attachments_pkey            |CREATE UNIQUE INDEX attachments_pkey ON public.attachments USING btree (attachment_id) |

Table name: bugs
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
bugs_pkey                   |CREATE UNIQUE INDEX bugs_pkey ON public.bugs USING btree (id)                      |
idx_bugs_project            |CREATE INDEX idx_bugs_project ON public.bugs USING btree (project_id)              |
idx_bugs_task               |CREATE INDEX idx_bugs_task ON public.bugs USING btree (task_id)                    |
idx_bugs_severity           |CREATE INDEX idx_bugs_severity ON public.bugs USING btree (severity)               |
idx_bugs_status             |CREATE INDEX idx_bugs_status ON public.bugs USING btree (status)                   |

Table name: comment_mentions
indexname                            |indexdef                                                                  |
------------------------------------+--------------------------------------------------------------------------|
comment_mentions_pkey               |CREATE UNIQUE INDEX comment_mentions_pkey ON public.comment_mentions USING btree (id) |
comment_mentions_comment_id_user_id_key |CREATE UNIQUE INDEX comment_mentions_comment_id_user_id_key ON public.comment_mentions USING btree (comment_id, user_id) |

Table name: comments
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
comments_pkey               |CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (comment_id)      |
idx_comments_task           |CREATE INDEX idx_comments_task ON public.comments USING btree (task_id)            |
idx_comments_user           |CREATE INDEX idx_comments_user ON public.comments USING btree (user_id)            |

Table name: notifications
indexname                       |indexdef                                                                       |
-------------------------------+-------------------------------------------------------------------------------|
notifications_pkey             |CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (notification_id) |
idx_notifications_created_at   |CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC) |
idx_notifications_user         |CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id) |
idx_notifications_read         |CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read) |
idx_notifications_sender       |CREATE INDEX idx_notifications_sender ON public.notifications USING btree (sender_id) |

Table name: plans
indexname                       |indexdef                                                                       |
-------------------------------+-------------------------------------------------------------------------------|
plans_pkey                     |CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (plan_id)           |
idx_plans_created_by           |CREATE INDEX idx_plans_created_by ON public.plans USING btree (created_by)     |
idx_plans_project              |CREATE INDEX idx_plans_project ON public.plans USING btree (project_id)        |
unique_active_plan_per_project |CREATE UNIQUE INDEX unique_active_plan_per_project ON public.plans USING btree (project_id) WHERE (is_active = true) |
idx_plans_updated_at           |CREATE INDEX idx_plans_updated_at ON public.plans USING btree (updated_at)     |

Table name: project_members
indexname                                |indexdef                                                               |
----------------------------------------+-----------------------------------------------------------------------|
project_members_pkey                    |CREATE UNIQUE INDEX project_members_pkey ON public.project_members USING btree (member_id) |
project_members_project_id_user_id_key  |CREATE UNIQUE INDEX project_members_project_id_user_id_key ON public.project_members USING btree (project_id, user_id) |
idx_project_members_project             |CREATE INDEX idx_project_members_project ON public.project_members USING btree (project_id) |
idx_project_members_user                |CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id) |

Table name: projects
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
projects_pkey               |CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (project_id)      |
idx_projects_owner          |CREATE INDEX idx_projects_owner ON public.projects USING btree (owner_id)          |

Table name: report_tasks
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
report_tasks_pkey           |CREATE UNIQUE INDEX report_tasks_pkey ON public.report_tasks USING btree (id)      |
idx_report_tasks_task       |CREATE INDEX idx_report_tasks_task ON public.report_tasks USING btree (task_id)    |
idx_report_tasks_report     |CREATE INDEX idx_report_tasks_report ON public.report_tasks USING btree (report_id) |

Table name: reports
indexname                                        |indexdef                                                      |
------------------------------------------------+--------------------------------------------------------------|
reports_pkey                                    |CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id) |
reports_report_type_report_date_project_id_key  |CREATE UNIQUE INDEX reports_report_type_report_date_project_id_key ON public.reports USING btree (report_type, report_date, project_id) |
idx_reports_type_date                           |CREATE INDEX idx_reports_type_date ON public.reports USING btree (report_type, report_date) |
idx_reports_project                             |CREATE INDEX idx_reports_project ON public.reports USING btree (project_id) |

Table name: snapshots
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
snapshots_pkey              |CREATE UNIQUE INDEX snapshots_pkey ON public.snapshots USING btree (snapshot_id)   |

Table name: tags
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
tags_pkey                   |CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (tag_id)                  |
idx_tags_project            |CREATE INDEX idx_tags_project ON public.tags USING btree (project_id)              |

Table name: task_durations
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
task_durations_pkey         |CREATE UNIQUE INDEX task_durations_pkey ON public.task_durations USING btree (duration_id) |

Table name: task_snapshots
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
task_snapshots_pkey         |CREATE UNIQUE INDEX task_snapshots_pkey ON public.task_snapshots USING btree (id)  |

Table name: task_status_history
indexname                        |indexdef                                                                      |
--------------------------------+------------------------------------------------------------------------------|
task_status_history_pkey        |CREATE UNIQUE INDEX task_status_history_pkey ON public.task_status_history USING btree (id) |
idx_task_status_history_task    |CREATE INDEX idx_task_status_history_task ON public.task_status_history USING btree (task_id) |
idx_task_status_history_date    |CREATE INDEX idx_task_status_history_date ON public.task_status_history USING btree (change_date) |

Table name: task_statuses
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
task_statuses_pkey          |CREATE UNIQUE INDEX task_statuses_pkey ON public.task_statuses USING btree (status_id) |
idx_task_statuses_project   |CREATE INDEX idx_task_statuses_project ON public.task_statuses USING btree (project_id) |

Table name: task_tags
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
task_tags_pkey              |CREATE UNIQUE INDEX task_tags_pkey ON public.task_tags USING btree (id)            |
task_tags_task_id_tag_id_key |CREATE UNIQUE INDEX task_tags_task_id_tag_id_key ON public.task_tags USING btree (task_id, tag_id) |

Table name: tasks
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
tasks_pkey                  |CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (task_id)               |
idx_tasks_project           |CREATE INDEX idx_tasks_project ON public.tasks USING btree (project_id)            |
idx_tasks_assignee          |CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee_id)          |
idx_tasks_parent            |CREATE INDEX idx_tasks_parent ON public.tasks USING btree (parent_task_id)         |

Table name: users
indexname                    |indexdef                                                                          |
----------------------------+------------------------------------------------------------------------------------|
users_pkey                  |CREATE UNIQUE INDEX users_pkey ON public.users USING btree (user_id)               |
users_email_key             |CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)            |
users_username_key          |CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username)      |
idx_users_email             |CREATE INDEX idx_users_email ON public.users USING btree (email)                   |
idx_users_username          |CREATE INDEX idx_users_username ON public.users USING btree (username)             |