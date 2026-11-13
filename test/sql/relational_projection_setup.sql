-- Copyright (c) 2015, 2025, Oracle and/or its affiliates.

-------------------------------------------------------------------------------
--
-- This software is dual-licensed to you under the Universal Permissive License
-- (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
-- 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
-- either license.
--
-- If you elect to accept the software under the Apache License, Version 2.0,
-- the following applies:
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--    https://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-------------------------------------------------------------------------------
-- 

conn username/password@cdb1_pdb3;
set serveroutput on
select obaas.settrace(1);

drop table items cascade constraints purge;
drop table payments cascade constraints purge;
drop table orders cascade constraints purge;
drop table scans cascade constraints purge;
drop table employees cascade constraints purge;
drop table directors cascade constraints purge;
drop table users_billing cascade constraints purge;
drop table users_start cascade constraints purge;
drop table users_end cascade constraints purge;
drop table users_4 cascade constraints purge;
drop table users_3 cascade constraints purge;
drop table users_2 cascade constraints purge;
drop table users_1 cascade constraints purge;

create table users_1 (
  uuid number,
  name varchar2(1000) not null,
  age number,
  about clob,
  constraint u1_pk primary key (uuid),
  constraint u1_uk unique (name, uuid)
);

create table users_2 (
  uuid number,
  name varchar2(1000) not null,
  age number,
  temp json,
  constraint u2_pk primary key (uuid),
  constraint u2_uk unique (name, uuid)
);

create table users_3 (
  uuid number,
  name varchar2(1000) not null,
  age number,
  temp json,
  constraint u3_pk primary key (uuid),
  constraint u3_uk unique (name, uuid)
);

create table users_4 (
  uuid number,
  name varchar2(1000) not null,
  age number,
  active timestamp,
  constraint u4_pk primary key (uuid),
  constraint u4_uk unique (name, uuid)
);

-- Separate parent objects let unhinted and hinted relationship tests coexist
-- without making the unhinted users_1 -> orders relationship ambiguous.
create table users_billing (uuid number primary key, name varchar2(1000));
create table users_start (uuid number primary key, name varchar2(1000));
create table users_end (uuid number primary key, name varchar2(1000));
create table directors (id number primary key, last_name varchar2(1000) not null);

create table orders (
  id number primary key,
  user_uuid number not null,
  billing_user_uuid number,
  director_id number,
  amount number(12, 2) not null,
  constraint orders_user_fk foreign key (user_uuid) references users_1(uuid),
  constraint billing foreign key (billing_user_uuid) references users_billing(uuid),
  constraint orders_director_fk foreign key (director_id) references directors(id)
);

create table items (
  id number primary key,
  order_id number not null,
  amount number(12, 2) not null,
  constraint items_order_fk foreign key (order_id) references orders(id)
);

create table payments (
  id number primary key,
  user_uuid number not null,
  amount number(12, 2) not null,
  constraint payments_user_fk foreign key (user_uuid) references users_1(uuid)
);

create table scans (
  id number primary key,
  start_user_uuid number not null,
  end_user_uuid number not null,
  constraint scan_id_start foreign key (start_user_uuid) references users_start(uuid),
  constraint scan_id_end foreign key (end_user_uuid) references users_end(uuid)
);

create table employees (
  id number primary key,
  name varchar2(1000) not null,
  manager_id number,
  constraint employees_manager_fk foreign key (manager_id) references employees(id)
);

insert into users_1 values (1, 'pratik', 29, to_clob('hi pratik'));
insert into users_1 values (2, 'hrishabh', 23, to_clob('hi hrishabh'));
insert into users_1 values (3, 'himanshu', 28, to_clob('hi himanshu'));
insert into users_1 values (4, 'chirag', 23, to_clob('hi chirag'));

insert into users_2 values (1, 'pratik', 29, json_array(1, 2, 3));
insert into users_2 values (2, 'hrishabh', 23, json_array(3, 4, 5));
insert into users_2 values (3, 'himanshu', 28, json_array(6, 7, 8));
insert into users_2 values (4, 'chirag', 23, json_array(1, 5, 9));

insert into users_3 values (1, 'pratik', 29, json('{"city":"Pune","phone":"9876543210","skills":["SQL","PL/SQL","Oracle"],"active":true}'));
insert into users_3 values (2, 'hrishabh', 23, json('{"city":"Delhi","phone":"9876543211","skills":["Java","Spring"],"active":false}'));
insert into users_3 values (3, 'himanshu', 28, json('{"city":"Bangalore","phone":"9876543212","skills":["Python","Oracle","Docker"],"experience":5}'));
insert into users_3 values (4, 'chirag', 23, json('{"city":"Hyderabad","phone":"9876543213","skills":["React","Node.js"]}'));

insert into users_4 values (1, 'pratik', 29, timestamp '2025-01-15 10:30:00');
insert into users_4 values (2, 'hrishabh', 23, timestamp '2025-03-20 14:45:30');
insert into users_4 values (3, 'himanshu', 28, systimestamp);
insert into users_4 values (4, 'chirag', 23, timestamp '2024-12-31 23:59:59');

insert into users_billing values (101, 'billing user');
insert into users_start values (201, 'start user');
insert into users_end values (301, 'end user');
insert into directors values (1, 'Doe');
insert into orders values (1, 1, 101, 1, 125.50);
insert into orders values (2, 2, 101, 1, 42.00);
insert into items values (1, 1, 25.50);
insert into items values (2, 1, 100.00);
insert into items values (3, 2, 42.00);
insert into payments values (1, 1, 125.50);
insert into payments values (2, 2, 42.00);
insert into scans values (1, 201, 301);
insert into employees values (1, 'director', null);
insert into employees values (2, 'manager', 1);
insert into employees values (3, 'developer', 2);

declare
  l_project_id varchar2(50);
  result number;
begin
  select project_id into l_project_id from table(obaas.list_projects);
  obaas.obaas_clean_relmetadata(result);
  dbms_output.put_line('Status clean: ' || result);
  -- result := obaas.obaas_setup_relmetadata(
  --   l_project_id,
  --   '["users_1","users_2","users_3","users_4","users_billing","users_start","users_end","directors","orders","items","payments","scans","employees"]',
  --   '[null,null,null,null,null,null,null,null,null,null,null,null,null]',
  --   1
  -- );
  -- dbms_output.put_line('Status: ' || result);
end;
/

commit;
