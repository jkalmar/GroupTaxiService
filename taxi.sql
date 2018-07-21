-- phpMyAdmin SQL Dump
-- version 4.8.2
-- https://www.phpmyadmin.net/
--
-- Hostiteľ: localhost
-- Čas generovania: So 21.Júl 2018, 20:05
-- Verzia serveru: 10.2.15-MariaDB
-- Verzia PHP: 7.2.7

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Databáza: `taxi`
--
CREATE DATABASE IF NOT EXISTS `taxi` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `taxi`;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `active_orders`
--

DROP TABLE IF EXISTS `active_orders`;
CREATE TABLE `active_orders` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `expriry` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `accepted_time` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `blacklist`
--

DROP TABLE IF EXISTS `blacklist`;
CREATE TABLE `blacklist` (
  `id` int(11) NOT NULL,
  `simSerial` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deviceSerial` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_DRIVER` int(11) NOT NULL,
  `id_CUSTOMER` int(11) DEFAULT NULL,
  `comment` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `broken_connections`
--

DROP TABLE IF EXISTS `broken_connections`;
CREATE TABLE `broken_connections` (
  `id` int(11) NOT NULL,
  `taxiId` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `customers`
--

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `nick` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blacklist` tinyint(1) NOT NULL DEFAULT 0,
  `rating_customer` tinyint(5) DEFAULT NULL,
  `comment` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `devices`
--

DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `serial_num_device` int(16) NOT NULL,
  `id_CUSTOMER` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `issues`
--

DROP TABLE IF EXISTS `issues`;
CREATE TABLE `issues` (
  `id` int(11) NOT NULL,
  `author` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` int(11) NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `checked` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Neskontrolovane'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `orders`
--

DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `fromLat` double DEFAULT NULL,
  `fromLng` double DEFAULT NULL,
  `fromTxt` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toLat` double DEFAULT NULL,
  `toLng` double DEFAULT NULL,
  `toTxt` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gps` tinyint(1) DEFAULT NULL,
  `seats` smallint(6) DEFAULT NULL,
  `kidSeats` smallint(6) DEFAULT NULL,
  `stroller` tinyint(1) DEFAULT NULL,
  `bag` tinyint(1) DEFAULT NULL,
  `bagWeight` int(11) DEFAULT NULL,
  `luggage` tinyint(1) DEFAULT NULL,
  `sAnimal` tinyint(1) DEFAULT NULL,
  `bAnimal` tinyint(1) DEFAULT NULL,
  `boxAnimal` tinyint(1) DEFAULT NULL,
  `noBoxAnimal` tinyint(1) DEFAULT NULL,
  `immobile` tinyint(1) DEFAULT NULL,
  `mobile` tinyint(1) DEFAULT NULL,
  `deaf` tinyint(1) DEFAULT NULL,
  `drinkTaxi` tinyint(1) DEFAULT NULL,
  `other` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` smallint(6) NOT NULL,
  `taxi` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `taxiId` int(11) DEFAULT NULL,
  `time` int(11) DEFAULT NULL,
  `isBlacklisted` tinyint(1) DEFAULT NULL,
  `simSerial` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deviceSerial` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_of_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `time_of_realization` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `taxi_drivers`
--

DROP TABLE IF EXISTS `taxi_drivers`;
CREATE TABLE `taxi_drivers` (
  `id` int(11) NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `logged` tinyint(1) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 0,
  `id_TAXI_OWNERS` int(11) DEFAULT NULL,
  `rating_driver` tinyint(5) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `taxi_owners`
--

DROP TABLE IF EXISTS `taxi_owners`;
CREATE TABLE `taxi_owners` (
  `id` int(11) NOT NULL,
  `company_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Štruktúra tabuľky pre tabuľku `views`
--

DROP TABLE IF EXISTS `views`;
CREATE TABLE `views` (
  `id` int(11) NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `views` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Kľúče pre exportované tabuľky
--

--
-- Indexy pre tabuľku `active_orders`
--
ALTER TABLE `active_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orders` (`order_id`),
  ADD KEY `drivers` (`driver_id`);

--
-- Indexy pre tabuľku `blacklist`
--
ALTER TABLE `blacklist`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sim` (`simSerial`),
  ADD KEY `device` (`deviceSerial`);

--
-- Indexy pre tabuľku `broken_connections`
--
ALTER TABLE `broken_connections`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`);

--
-- Indexy pre tabuľku `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `issues`
--
ALTER TABLE `issues`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `taxi_drivers`
--
ALTER TABLE `taxi_drivers`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `taxi_owners`
--
ALTER TABLE `taxi_owners`
  ADD PRIMARY KEY (`id`);

--
-- Indexy pre tabuľku `views`
--
ALTER TABLE `views`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- AUTO_INCREMENT pre exportované tabuľky
--

--
-- AUTO_INCREMENT pre tabuľku `active_orders`
--
ALTER TABLE `active_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `blacklist`
--
ALTER TABLE `blacklist`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `broken_connections`
--
ALTER TABLE `broken_connections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `issues`
--
ALTER TABLE `issues`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `taxi_drivers`
--
ALTER TABLE `taxi_drivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `taxi_owners`
--
ALTER TABLE `taxi_owners`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pre tabuľku `views`
--
ALTER TABLE `views`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
