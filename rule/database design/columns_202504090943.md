Table name: activity_logs
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
task_id                   |               3|uuid                    |YES        |                                 |
user_id                   |               4|uuid                    |NO         |                                 |
action                    |               5|character varying       |NO         |                                 |
entity_type               |               6|character varying       |NO         |                                 |
entity_id                 |               7|uuid                    |NO         |                                 |
details                   |               8|jsonb                   |YES        |                                 |
created_at                |               9|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: attachments
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
attachment_id             |               1|uuid                    |NO         |uuid_generate_v4()               |
owner_type                |               2|character varying       |NO         |                                 |
owner_id                  |               3|uuid                    |NO         |                                 |
file_name                 |               4|character varying       |NO         |                                 |
file_path                 |               5|character varying       |NO         |                                 |
file_size                 |               6|bigint                  |NO         |                                 |
file_type                 |               7|character varying       |NO         |                                 |
uploaded_by               |               8|uuid                    |NO         |                                 |
uploaded_at               |               9|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
is_deleted                |              10|boolean                 |NO         |false                            |

Table name: bugs
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
task_id                   |               2|uuid                    |YES        |                                 |
project_id                |               3|uuid                    |NO         |                                 |
title                     |               4|character varying       |NO         |                                 |
description               |               5|text                    |YES        |                                 |
severity                  |               6|USER-DEFINED            |NO         |                                 |
status                    |               7|USER-DEFINED            |NO         |'open'::bug_status               |
priority                  |               8|integer                 |YES        |                                 |
assignee_id               |               9|uuid                    |YES        |                                 |
reporter_id               |              10|uuid                    |YES        |                                 |
date_discovered           |              11|date                    |NO         |                                 |
date_resolved             |              12|date                    |YES        |                                 |
resolution_time           |              13|integer                 |YES        |                                 |
resolution_description    |              14|text                    |YES        |                                 |
affected_components       |              15|jsonb                   |YES        |                                 |
tags                      |              16|jsonb                   |YES        |                                 |
created_at                |              17|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
updated_at                |              18|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |

Table name: comment_mentions
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
comment_id                |               2|uuid                    |NO         |                                 |
user_id                   |               3|uuid                    |NO         |                                 |
is_read                   |               4|boolean                 |NO         |false                            |
created_at                |               5|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: comments
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
comment_id                |               1|uuid                    |NO         |uuid_generate_v4()               |
task_id                   |               2|uuid                    |NO         |                                 |
user_id                   |               3|uuid                    |NO         |                                 |
content                   |               4|text                    |NO         |                                 |
parent_id                 |               5|uuid                    |YES        |                                 |
created_at                |               6|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
updated_at                |               7|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
is_deleted                |               8|boolean                 |YES        |false                            |
metadata                  |               9|jsonb                   |YES        |                                 |

Table name: notifications
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
notification_id           |               1|uuid                    |NO         |uuid_generate_v4()               |
user_id                   |               2|uuid                    |NO         |                                 |
type                      |               3|character varying       |NO         |                                 |
reference_type            |               4|character varying       |NO         |                                 |
reference_id              |               5|uuid                    |NO         |                                 |
message                   |               6|text                    |NO         |                                 |
is_read                   |               7|boolean                 |NO         |false                            |
created_at                |               8|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
project_id                |               9|uuid                    |YES        |                                 |
sender_id                 |              10|uuid                    |YES        |                                 |
action                    |              11|character varying       |NO         |'notification'::character varying|
metadata                  |              12|jsonb                   |YES        |'{}'::jsonb                      |

Table name: plans
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
plan_id                   |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
name                      |               3|character varying       |NO         |                                 |
description               |               4|text                    |YES        |                                 |
created_by                |               5|uuid                    |NO         |                                 |
created_at                |               6|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
updated_at                |               7|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
is_active                 |               8|boolean                 |NO         |false                            |
plan_data                 |               9|jsonb                   |NO         |'{}'::jsonb                      |

Table name: project_members
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
member_id                 |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
user_id                   |               3|uuid                    |NO         |                                 |
joined_at                 |               4|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
invited_by                |               5|uuid                    |YES        |                                 |
role                      |               6|USER-DEFINED            |NO         |'member'::member_role            |

Table name: projects
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
project_id                |               1|uuid                    |NO         |uuid_generate_v4()               |
name                      |               2|character varying       |NO         |                                 |
description               |               3|text                    |YES        |                                 |
owner_id                  |               4|uuid                    |NO         |                                 |
created_at                |               5|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
updated_at                |               6|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
priority                  |               7|USER-DEFINED            |NO         |'medium'::project_priority       |
visibility                |               8|USER-DEFINED            |NO         |'private'::project_visibility    |
tags                      |               9|jsonb                   |YES        |                                 |
progress                  |              10|double precision        |NO         |0                                |
category                  |              11|character varying       |YES        |                                 |
metadata                  |              12|jsonb                   |YES        |                                 |
start_date                |              13|date                    |YES        |                                 |
end_date                  |              14|date                    |YES        |                                 |
icon_url                  |              15|character varying       |YES        |                                 |
is_public                 |              16|boolean                 |NO         |false                            |
status                    |              17|USER-DEFINED            |NO         |'active'::project_status         |

Table name: report_tasks
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
report_id                 |               2|uuid                    |NO         |                                 |
task_id                   |               3|uuid                    |NO         |                                 |
task_title                |               4|character varying       |NO         |                                 |
assignee_id               |               5|uuid                    |YES        |                                 |
planned_start_date        |               6|timestamp with time zone|YES        |                                 |
planned_end_date          |               7|timestamp with time zone|YES        |                                 |
actual_start_date         |               8|timestamp with time zone|YES        |                                 |
actual_end_date           |               9|timestamp with time zone|YES        |                                 |
status                    |              10|USER-DEFINED            |NO         |                                 |
is_delayed                |              11|boolean                 |YES        |false                            |
delay_reason              |              12|text                    |YES        |                                 |
remarks                   |              13|text                    |YES        |                                 |
created_at                |              14|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |

Table name: reports
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
report_type               |               2|USER-DEFINED            |NO         |                                 |
report_date               |               3|date                    |NO         |                                 |
project_id                |               4|uuid                    |NO         |                                 |
plan_id                   |               5|uuid                    |YES        |                                 |
period_start_date         |               6|date                    |NO         |                                 |
period_end_date           |               7|date                    |NO         |                                 |
total_tasks               |               8|integer                 |NO         |0                                |
completed_tasks           |               9|integer                 |NO         |0                                |
delayed_tasks             |              10|integer                 |NO         |0                                |
on_schedule_tasks         |              11|integer                 |NO         |0                                |
new_started_tasks         |              12|integer                 |NO         |0                                |
unassigned_resources      |              13|jsonb                   |YES        |                                 |
total_bugs                |              14|integer                 |NO         |0                                |
critical_bugs             |              15|integer                 |NO         |0                                |
major_bugs                |              16|integer                 |NO         |0                                |
minor_bugs                |              17|integer                 |NO         |0                                |
resolved_bugs             |              18|integer                 |NO         |0                                |
summary                   |              19|text                    |YES        |                                 |
created_at                |              20|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
updated_at                |              21|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |

Table name: snapshots
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
snapshot_id               |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
name                      |               3|character varying       |NO         |                                 |
description               |               4|text                    |YES        |                                 |
created_by                |               5|uuid                    |NO         |                                 |
created_at                |               6|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: tags
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
tag_id                    |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
name                      |               3|character varying       |NO         |                                 |
color                     |               4|character varying       |YES        |                                 |
created_at                |               5|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: task_durations
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
duration_id               |               1|uuid                    |NO         |uuid_generate_v4()               |
task_id                   |               2|uuid                    |NO         |                                 |
start_datetime            |               3|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
end_datetime              |               4|timestamp with time zone|YES        |                                 |
status                    |               5|character varying       |NO         |                                 |
note                      |               6|text                    |YES        |                                 |
created_by                |               7|uuid                    |NO         |                                 |
created_at                |               8|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
updated_at                |               9|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: task_snapshots
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
snapshot_id               |               2|uuid                    |NO         |                                 |
task_id                   |               3|uuid                    |NO         |                                 |
title                     |               4|character varying       |NO         |                                 |
description               |               5|text                    |YES        |                                 |
assignee_id               |               6|uuid                    |YES        |                                 |
status                    |               7|USER-DEFINED            |NO         |                                 |
priority_order            |               8|integer                 |NO         |                                 |
start_date                |               9|timestamp with time zone|YES        |                                 |
due_date                  |              10|timestamp with time zone|YES        |                                 |
effort                    |              11|numeric                 |YES        |                                 |
progress                  |              12|integer                 |YES        |                                 |

Table name: task_status_history
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
task_id                   |               2|uuid                    |NO         |                                 |
previous_status           |               3|USER-DEFINED            |YES        |                                 |
new_status                |               4|USER-DEFINED            |NO         |                                 |
changed_by                |               5|uuid                    |YES        |                                 |
change_date               |               6|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
remarks                   |               7|text                    |YES        |                                 |

Table name: task_statuses
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
status_id                 |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
name                      |               3|character varying       |NO         |                                 |
description               |               4|text                    |YES        |                                 |
color                     |               5|character varying       |YES        |                                 |
display_order             |               6|integer                 |NO         |0                                |
is_default                |               7|boolean                 |NO         |false                            |
is_done                   |               8|boolean                 |NO         |false                            |
created_at                |               9|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |
updated_at                |              10|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: task_tags
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
id                        |               1|uuid                    |NO         |uuid_generate_v4()               |
task_id                   |               2|uuid                    |NO         |                                 |
tag_id                    |               3|uuid                    |NO         |                                 |
created_at                |               4|timestamp with time zone|NO         |CURRENT_TIMESTAMP                |

Table name: tasks
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
task_id                   |               1|uuid                    |NO         |uuid_generate_v4()               |
project_id                |               2|uuid                    |NO         |                                 |
parent_task_id            |               3|uuid                    |YES        |                                 |
title                     |               4|character varying       |NO         |                                 |
description               |               5|text                    |YES        |                                 |
assignee_id               |               6|uuid                    |YES        |                                 |
priority_order            |               7|integer                 |NO         |0                                |
start_date                |               8|timestamp with time zone|YES        |                                 |
due_date                  |               9|timestamp with time zone|YES        |                                 |
actual_start_date         |              10|timestamp with time zone|YES        |                                 |
actual_end_date           |              11|timestamp with time zone|YES        |                                 |
effort                    |              12|double precision        |YES        |                                 |
progress                  |              13|double precision        |YES        |0                                |
created_by                |              14|uuid                    |NO         |                                 |
created_at                |              15|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
updated_at                |              16|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
is_deleted                |              17|boolean                 |YES        |false                            |
status                    |              18|USER-DEFINED            |NO         |'todo'::task_status              |
priority                  |              19|USER-DEFINED            |NO         |'medium'::task_priority          |
type                      |              20|character varying       |YES        |                                 |
category                  |              21|character varying       |YES        |                                 |
tags                      |              22|jsonb                   |YES        |                                 |
progress_type             |              23|USER-DEFINED            |YES        |                                 |

Table name: users
column_name               |ordinal_position|data_type               |is_nullable|column_default                   |
--------------------------+----------------+------------------------+-----------+---------------------------------+
user_id                   |               1|uuid                    |NO         |uuid_generate_v4()               |
email                     |               2|character varying       |NO         |                                 |
password_hash             |               3|character varying       |YES        |                                 |
full_name                 |               4|character varying       |YES        |                                 |
username                  |               5|character varying       |NO         |                                 |
avatar_url                |               6|character varying       |YES        |                                 |
bio                       |               7|text                    |YES        |                                 |
google_id                 |               8|character varying       |YES        |                                 |
is_email_verified         |               9|boolean                 |YES        |                                 |
created_at                |              10|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
updated_at                |              11|timestamp with time zone|YES        |CURRENT_TIMESTAMP                |
last_login_at             |              12|timestamp with time zone|YES        |                                 |
name                      |              13|character varying       |YES        |                                 |
email_verified            |              14|boolean                 |NO         |false                            |
verification_token        |              15|character varying       |YES        |                                 |
verification_token_expires|              16|timestamp with time zone|YES        |                                 |
reset_token               |              17|character varying       |YES        |                                 |
reset_token_expires       |              18|timestamp with time zone|YES        |                                 |
firebase_uid              |              19|character varying       |YES        |                                 |
role                      |              20|USER-DEFINED            |NO         |'user'::user_role                |
provider                  |              21|USER-DEFINED            |NO         |'email'::user_provider           |
work_capacity             |              22|integer                 |YES        |                                 |
metadata                  |              23|jsonb                   |YES        |                                 |